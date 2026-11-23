/** 연속 차단 단계 조치: 센 사유만, 경고 → 제한, 이미 제한 중이면 늘리지 않음, 정지 검토 목록. DATABASE_URL이 없으면 건너뛴다 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("연속 차단 조치", async () => {
  const { db } = await import("@/lib/db");
  const A = await import("@/lib/abuse");
  const ids: string[] = [];
  const newUser = async () => {
    const id = (await db.user.create({ data: { email: `abuse-${randomUUID()}@example.test` } })).id;
    ids.push(id);
    return id;
  };
  const block = (userId: string, blockCode: string, createdAt = new Date()) =>
    db.generationLog.create({
      data: { requestId: randomUUID(), userId, mode: "natural", profile: "p", requestText: "x", outcome: "block", blockCode, creditCost: 0, createdAt },
    });
  const counted = A.COUNTED_CODES[0];

  beforeAll(() => expect(A.COUNTED_CODES.length).toBeGreaterThan(0));
  afterAll(async () => {
    await db.adminLog.deleteMany({ where: { targetUserId: { in: ids } } });
    await db.generationLog.deleteMany({ where: { userId: { in: ids } } }); // 기록이 남은 사용자는 삭제가 거부된다
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("이미지 판정 차단은 세지 않는다", async () => {
    const u = await newUser();
    for (let i = 0; i < A.ABUSE.restrict_after + 2; i++) await block(u, "AGE_UNCERTAIN");
    expect(await A.recordBlock(u, "AGE_UNCERTAIN")).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).restrictedUntil).toBeNull();
  });

  it("경고 → 제한, 제한 중에는 늘리지 않는다", async () => {
    const u = await newUser();
    let last = null;
    for (let i = 1; i <= A.ABUSE.restrict_after; i++) {
      await block(u, counted);
      last = await A.recordBlock(u, counted);
      if (i < A.ABUSE.warn_after) expect(last).toBeNull();
      else if (i < A.ABUSE.restrict_after) expect(last).toBe("abuseWarn");
    }
    expect(last).toBe("abuseRestricted");
    const until = (await db.user.findUniqueOrThrow({ where: { id: u } })).restrictedUntil!;
    expect(A.isRestricted({ restrictedUntil: until })).toBe(true);
    await block(u, counted);
    await A.recordBlock(u, counted);
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).restrictedUntil).toEqual(until);
    expect(await db.adminLog.count({ where: { targetUserId: u, action: "auto_restrict" } })).toBe(1);
  });

  it("시간 창 밖의 차단은 세지 않는다", async () => {
    const u = await newUser();
    const old = new Date(Date.now() - (A.ABUSE.window_minutes + 5) * 60_000);
    for (let i = 0; i < A.ABUSE.restrict_after; i++) await block(u, counted, old);
    expect(await A.recordBlock(u, counted)).toBeNull();
  });

  it("자동 제한이 반복되면 정지 검토 목록에 오른다", async () => {
    const u = await newUser();
    for (let i = 0; i < A.ABUSE.review_after_restrictions; i++) {
      await db.adminLog.create({ data: { adminEmail: "system", action: "auto_restrict", targetUserId: u } });
    }
    expect((await A.reviewCandidates()).some((c) => c.id === u)).toBe(true);
    await db.user.update({ where: { id: u }, data: { suspendedAt: new Date() } });
    expect((await A.reviewCandidates()).some((c) => c.id === u)).toBe(false);
  });
});
