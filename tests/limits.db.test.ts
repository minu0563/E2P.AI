/**
 * DB 기반 속도 제한·동시 1건·우회 기록과 요청 내 생성 흐름(크레딧 정산) 통합 테스트.
 * 로컬 Postgres 필요(docker compose up -d). 파이프라인(모델 호출)은 가짜. DATABASE_URL이 없으면 건너뛴다.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const pipeline = vi.hoisted(() => ({ runPipeline: vi.fn() }));
vi.mock("@/lib/pipeline", () => pipeline);

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("DB 제한·요청 내 생성", async () => {
  const { db } = await import("@/lib/db");
  const c = await import("@/lib/credits");
  const L = await import("@/lib/limits");
  const { markBlocked, wasBlocked } = await import("@/system/safety/history");
  const { runGeneration } = await import("@/lib/generate");
  const { getProfile, DEFAULT_PROFILE } = await import("@/lib/profile");
  const profile = getProfile(DEFAULT_PROFILE)!;

  let userId = "";
  const bal = async () => (await c.getBalance(userId)).total;
  const ok = (requestId: string) => ({ ok: true, requestId, prompt: "p", filled: {}, notices: [], meta: { shot_type: "bust", viewpoint: "front" }, timings: { totalMs: 1 } });
  const job = (requestId: string) => ({
    requestId,
    userId,
    profile,
    input: { inputMode: "natural" as const, request: "걷는다", fields: {} as never, placeholder: false, duration: 6, aspectRatio: "", pace: "normal" as const },
    image: { base64: randomBytes(100).toString("base64"), hash: randomUUID() },
    savedInput: { inputMode: "natural" as const, request: "걷는다", fields: {}, placeholder: false, duration: 6, aspectRatio: "", pace: "normal" as const },
  });
  /** POST /api/generate와 같은 순서: 자리 → 예약 → 처리 */
  async function start() {
    const id = randomUUID();
    expect(await L.claimSlot(userId, id)).toBe(true);
    expect((await c.reserveCredits(userId, id)).ok).toBe(true);
    return id;
  }

  beforeAll(async () => {
    userId = (await db.user.create({ data: { email: `test-limits-${Date.now()}@example.test` } })).id;
    await c.grantCredits({ userId, amount: 50, creditType: "topup", expiresAt: null, idempotencyKey: `l:${userId}` });
  });
  afterAll(async () => {
    await db.activeGeneration.deleteMany({ where: { userId } });
    await db.generationLog.deleteMany({ where: { userId } });
    await db.creditEntry.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("속도 제한: 동시에 몰려도 창 안에서 정확히 max번까지만", async () => {
    const key = `t:${randomUUID()}`;
    const rs = await Promise.all(Array.from({ length: 20 }, () => L.hit(key, 7, 60)));
    expect(rs.filter(Boolean).length).toBe(7);
  });

  it("동시 1건: 동시에 잡아도 하나만, 자기 자리만 풀 수 있고, 만료되면 다시 잡힌다", async () => {
    const ids = Array.from({ length: 8 }, () => randomUUID());
    const rs = await Promise.all(ids.map((id) => L.claimSlot(userId, id)));
    expect(rs.filter(Boolean).length).toBe(1);
    const owner = ids[rs.indexOf(true)];
    await L.releaseSlot(userId, ids.find((i) => i !== owner)!);
    expect(await L.claimSlot(userId, randomUUID())).toBe(false);
    // 비정상 종료로 남은 자리: 만료 후 새 요청이 가져간다
    await db.activeGeneration.update({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const next = randomUUID();
    expect(await L.claimSlot(userId, next)).toBe(true);
    await L.releaseSlot(userId, next);
    expect(await db.activeGeneration.count({ where: { userId } })).toBe(0);
  });

  it("우회 루프 기록: 해시만 저장, 만료되면 사라진다", async () => {
    const h = randomUUID();
    expect(await wasBlocked(h)).toBe(false);
    await markBlocked(h);
    expect(await wasBlocked(h)).toBe(true);
    await db.blockedImage.update({ where: { hash: h }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await wasBlocked(h)).toBe(false);
    await L.cleanupExpiredLimits();
    expect(await db.blockedImage.findUnique({ where: { hash: h } })).toBeNull();
  });

  it("성공: 단계 알림, 크레딧 확정, 기록 저장, 자리 해제", async () => {
    const start0 = await bal();
    pipeline.runPipeline.mockImplementationOnce(async (i: { requestId: string; onStage?: (s: string) => void }) => {
      i.onStage?.("analyzing");
      i.onStage?.("writing");
      return ok(i.requestId);
    });
    const id = await start();
    const stages: string[] = [];
    const r = await runGeneration(job(id), { onStage: (s) => stages.push(s), isCancelled: () => false });
    expect(r.ok).toBe(true);
    expect(stages).toEqual(["analyzing", "writing"]);
    expect(await bal()).toBe(start0 - 1);
    expect((await db.generationLog.findUnique({ where: { requestId: id } }))?.outcome).toBe("ok");
    expect(await db.activeGeneration.count({ where: { userId } })).toBe(0);
  });

  it("처리 중 취소(연결 끊김): 크레딧 반환, 자리 해제", async () => {
    const start0 = await bal();
    let cancelled = false;
    pipeline.runPipeline.mockImplementationOnce(async (i: { requestId: string }) => {
      cancelled = true; // 처리 도중 사용자가 끊음
      return ok(i.requestId);
    });
    const id = await start();
    const r = await runGeneration(job(id), { isCancelled: () => cancelled });
    expect(r).toMatchObject({ ok: false, code: "CANCELLED" });
    expect(await bal()).toBe(start0);
    expect(await db.activeGeneration.count({ where: { userId } })).toBe(0);
  });

  it("예상 못 한 오류: 크레딧 반환, 시스템 오류 응답", async () => {
    const start0 = await bal();
    pipeline.runPipeline.mockRejectedValueOnce(new Error("boom"));
    const r = await runGeneration(job(await start()), { isCancelled: () => false });
    expect(r).toMatchObject({ ok: false, code: "SYSTEM_ERROR" });
    expect(await bal()).toBe(start0);
  });

  it("차단: 하루 무료 횟수 안이면 반환", async () => {
    const start0 = await bal();
    pipeline.runPipeline.mockImplementationOnce(async (i: { requestId: string }) => ({ ok: false, requestId: i.requestId, code: "SEXUAL_REQUEST", message: "x" }));
    const r = await runGeneration(job(await start()), { isCancelled: () => false });
    expect(r).toMatchObject({ ok: false, code: "SEXUAL_REQUEST" });
    expect(await bal()).toBe(start0);
  });

  it("판정값은 기록에만 저장되고 응답에는 없다", async () => {
    const id = await start();
    const img = { image_type: "photo", person_count: 1, person_centric: true, estimated_age: 24, minor_cues: ["school_uniform"], age_assessment: "ambiguous", sexual_content: "none", subject: "a person", scene: "classroom" };
    pipeline.runPipeline.mockImplementationOnce(async (i: { requestId: string; onJudgment?: (j: unknown) => void }) => {
      i.onJudgment?.({ imageHash: "h-judg", image: img, request: { request_level: "general", third_party_claim: false }, keywords: {}, rule: { action: "block", code: "AGE_UNCERTAIN", flags: { ageDowngraded: true } } });
      return { ok: false, requestId: i.requestId, code: "AGE_UNCERTAIN", message: "x" };
    });
    const r = await runGeneration(job(id), { isCancelled: () => false });
    expect(JSON.stringify(r)).not.toContain("ambiguous");
    const log = await db.generationLog.findUnique({ where: { requestId: id } });
    expect(log).toMatchObject({ imageHash: "h-judg", imageType: "photo", estimatedAge: 24, ageAssessment: "ambiguous", minorCues: ["school_uniform"], requestLevel: "general", thirdPartyClaim: false, falsePositive: false });
    expect(log!.judgment).toMatchObject({ scene: "classroom", rule: { code: "AGE_UNCERTAIN", flags: { ageDowngraded: true } } });
  });
});
