/** 이미지 삭제 요청: hold는 남기고, 저장소에서 지운 뒤에만 기록을 비운다. DATABASE_URL이 없으면 건너뛴다 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("이미지 삭제", async () => {
  const { db } = await import("@/lib/db");
  const { eraseImages } = await import("@/lib/image-erase");
  let me = "";
  let other = "";
  const log = (userId: string, imageTier: string | null) =>
    db.generationLog.create({
      data: {
        requestId: randomUUID(),
        userId,
        mode: "natural",
        profile: "p",
        requestText: "걷는다",
        outcome: "ok",
        creditCost: 1,
        imageTier,
        imageStoredAt: imageTier ? new Date() : null,
        imageExpiresAt: imageTier ? new Date(Date.now() + 86_400_000) : null,
      },
    });
  const tier = async (requestId: string) =>
    (await db.generationLog.findUniqueOrThrow({ where: { requestId } })).imageTier;

  beforeAll(async () => {
    me = (await db.user.create({ data: { email: `erase-me-${Date.now()}@example.test` } })).id;
    other = (await db.user.create({ data: { email: `erase-other-${Date.now()}@example.test` } })).id;
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [me, other] } } });
  });

  it("사용자 전체: hold는 남기고 나머지만 지운다, 남의 것은 건드리지 않는다", async () => {
    const a = await log(me, "recent");
    const b = await log(me, "blocked");
    const h = await log(me, "hold");
    const o = await log(other, "recent");
    const removed: string[] = [];
    const r = await eraseImages({ userId: me }, async (ids) => (removed.push(...ids), true));
    expect(r).toEqual({ ok: true, deleted: 2, held: 1 });
    expect(removed.sort()).toEqual([a.requestId, b.requestId].sort());
    expect(await tier(a.requestId)).toBeNull();
    expect(await tier(h.requestId)).toBe("hold");
    expect(await tier(o.requestId)).toBe("recent");
  });

  it("생성 건 하나만", async () => {
    const a = await log(me, "recent");
    const b = await log(me, "recent");
    expect(await eraseImages({ requestId: a.requestId }, async () => true)).toEqual({ ok: true, deleted: 1, held: 0 });
    expect(await tier(a.requestId)).toBeNull();
    expect(await tier(b.requestId)).toBe("recent");
  });

  it("저장소에서 못 지우면 기록을 바꾸지 않는다", async () => {
    const a = await log(me, "blocked");
    expect(await eraseImages({ requestId: a.requestId }, async () => false)).toEqual({ ok: false, code: "STORE_UNAVAILABLE" });
    expect(await tier(a.requestId)).toBe("blocked");
  });

  it("지울 것이 없으면 저장소를 부르지 않는다", async () => {
    const fn = vi.fn(async () => true);
    expect(await eraseImages({ userId: other + "-none" }, fn)).toEqual({ ok: true, deleted: 0, held: 0 });
    expect(fn).not.toHaveBeenCalled();
  });
});
