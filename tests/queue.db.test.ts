/**
 * 큐·워커·속도 제한 통합 테스트 (로컬 Postgres + Redis 필요: docker compose up -d).
 * 파이프라인(모델 호출)은 가짜로 바꾼다. DATABASE_URL·REDIS_URL이 없으면 건너뛴다.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.QUEUE_NAME = `generate-test-${process.pid}`;
process.env.QUEUE_SECRET ??= randomBytes(32).toString("hex");

const pipeline = vi.hoisted(() => ({ runPipeline: vi.fn() }));
vi.mock("@/lib/pipeline", () => pipeline);

const run = process.env.DATABASE_URL && process.env.REDIS_URL ? describe : describe.skip;

run("큐·워커·속도 제한", async () => {
  const { Worker } = await import("bullmq");
  const { db } = await import("@/lib/db");
  const { getRedis } = await import("@/lib/redis");
  const c = await import("@/lib/credits");
  const q = await import("@/lib/queue");
  const { processGenerateJob } = await import("@/lib/queue/process");
  const { hit } = await import("@/lib/rate-limit");
  const { DEFAULT_PROFILE } = await import("@/lib/profile");

  let userId = "";
  const bal = async () => (await c.getBalance(userId)).total;
  const image = { base64: randomBytes(2000).toString("base64"), hash: "h" + randomUUID() };
  const ok = (requestId: string) => ({
    ok: true,
    requestId,
    prompt: "p",
    filled: {},
    notices: [],
    meta: { shot_type: "bust", viewpoint: "front" },
    timings: { totalMs: 1 },
  });

  /** 예약 + 이미지 + 작업 등록 (POST /api/generate 와 같은 순서) */
  async function enqueue() {
    const requestId = randomUUID();
    expect((await c.reserveCredits(userId, requestId)).ok).toBe(true);
    await q.putImage(requestId, image);
    return q.getQueue().add(
      "generate",
      {
        requestId,
        userId,
        profileId: DEFAULT_PROFILE,
        input: { inputMode: "natural", request: "걷는다", fields: {} as never, placeholder: false, duration: 6, aspectRatio: "", pace: "normal" },
        imageHash: image.hash,
        savedInput: { inputMode: "natural", request: "걷는다", fields: {}, placeholder: false, duration: 6, aspectRatio: "", pace: "normal" },
      },
      { jobId: requestId },
    );
  }

  beforeAll(async () => {
    const u = await db.user.create({ data: { email: `test-queue-${Date.now()}@example.test` } });
    userId = u.id;
    await c.grantCredits({ userId, amount: 100, creditType: "topup", expiresAt: null, idempotencyKey: `q:${userId}` });
  });
  afterAll(async () => {
    await q.getQueue().obliterate({ force: true });
    await q.getQueue().close();
    await db.generationLog.deleteMany({ where: { userId } });
    await db.creditEntry.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
    getRedis().disconnect();
  });

  it("속도 제한: 창 안에서 max번까지만 허용", async () => {
    const key = `test:${randomUUID()}`;
    const rs = await Promise.all(Array.from({ length: 5 }, () => hit(key, 3, 60)));
    expect(rs.filter(Boolean).length).toBe(3);
  });

  it("사용자당 동시 1건: 동시에 잡아도 하나만 성공, 자기 자리만 풀 수 있다", async () => {
    const ids = Array.from({ length: 5 }, () => randomUUID());
    const rs = await Promise.all(ids.map((id) => q.claimSlot(userId, id)));
    expect(rs.filter(Boolean).length).toBe(1);
    const owner = ids[rs.indexOf(true)];
    await q.releaseSlot(userId, ids.find((i) => i !== owner)!);
    expect(await q.claimSlot(userId, randomUUID())).toBe(false);
    await q.releaseSlot(userId, owner);
    const again = randomUUID();
    expect(await q.claimSlot(userId, again)).toBe(true);
    await q.releaseSlot(userId, again);
  });

  it("성공: 크레딧 확정, 이미지 삭제, 기록 저장", async () => {
    const start = await bal();
    pipeline.runPipeline.mockImplementationOnce(async (i: { requestId: string; image: { base64: string } }) => {
      expect(i.image.base64).toBe(image.base64); // 암호화 → 복호화된 이미지
      return ok(i.requestId);
    });
    const job = await enqueue();
    const r = await processGenerateJob(job);
    expect(r.ok).toBe(true);
    expect(await bal()).toBe(start - 1);
    expect(await getRedis().exists(`img:${job.id}`)).toBe(0);
    expect((await db.generationLog.findUnique({ where: { requestId: job.id! } }))?.outcome).toBe("ok");
  });

  it("취소 표시가 있으면 반환", async () => {
    const start = await bal();
    const job = await enqueue();
    await q.requestCancel(job.id!);
    const r = await processGenerateJob(job);
    expect(r).toMatchObject({ ok: false, code: "CANCELLED" });
    expect(await bal()).toBe(start);
  });

  it("처리 중 오류는 반환", async () => {
    const start = await bal();
    pipeline.runPipeline.mockRejectedValueOnce(new Error("boom"));
    const r = await processGenerateJob(await enqueue());
    expect(r).toMatchObject({ ok: false, code: "SYSTEM_ERROR" });
    expect(await bal()).toBe(start);
  });

  it("너무 오래 기다린 작업은 처리하지 않고 반환", async () => {
    const start = await bal();
    const job = await enqueue();
    job.timestamp = Date.now() - (q.QUEUE_CONFIG.max_wait_seconds + 1) * 1000;
    pipeline.runPipeline.mockClear();
    const r = await processGenerateJob(job);
    expect(r).toMatchObject({ ok: false, code: "SYSTEM_ERROR" });
    expect(pipeline.runPipeline).not.toHaveBeenCalled();
    expect(await bal()).toBe(start);
  });

  it("워커는 들어온 순서대로, 동시에 정해진 수만큼만 처리", async () => {
    const order: string[] = [];
    let running = 0;
    let maxRunning = 0;
    pipeline.runPipeline.mockImplementation(async (i: { requestId: string }) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      order.push(i.requestId);
      await new Promise((r) => setTimeout(r, 30));
      running--;
      return ok(i.requestId);
    });
    await q.getQueue().drain(); // 앞 테스트에서 직접 처리한 작업들 비우기
    const jobs = [];
    for (let i = 0; i < 6; i++) jobs.push(await enqueue());
    expect(await q.queuePosition(jobs[2].id!)).toBe(3);

    const worker = new Worker(q.QUEUE_NAME, processGenerateJob, { connection: getRedis(), concurrency: 1 });
    await new Promise<void>((resolve) => {
      let done = 0;
      worker.on("completed", () => ++done === jobs.length && resolve());
    });
    await worker.close();
    expect(order).toEqual(jobs.map((j) => j.id));
    expect(maxRunning).toBe(1);
  });
});
