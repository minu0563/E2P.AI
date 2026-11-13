/**
 * 크레딧 원장 통합 테스트 (로컬 Postgres 필요: docker compose up -d).
 * DATABASE_URL이 없으면 건너뛴다.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("크레딧 원장 (DB)", async () => {
  const { db } = await import("@/lib/db");
  const c = await import("@/lib/credits");
  let userId = "";

  beforeAll(async () => {
    const u = await db.user.create({ data: { email: `test-${Date.now()}@example.test` } });
    userId = u.id;
  });
  afterAll(async () => {
    await db.creditEntry.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("가입 지급은 한 번만 (멱등성)", async () => {
    expect(await c.grantSignupCredits(userId)).toBe(true);
    expect(await c.grantSignupCredits(userId)).toBe(false);
    expect((await c.getBalance(userId)).total).toBe(c.CREDIT_CONFIG.signup.amount);
  });

  it("예약 → 확정은 차감, 예약 → 반환은 원복, 정산은 한 번만", async () => {
    const start = (await c.getBalance(userId)).total;
    expect(await c.reserveCredits(userId, "r1")).toEqual({ ok: true });
    expect(await c.confirmCredits(userId, "r1")).toBe(true);
    expect(await c.releaseCredits(userId, "r1")).toBe(false);
    expect((await c.getBalance(userId)).total).toBe(start - 1);

    expect(await c.reserveCredits(userId, "r2")).toEqual({ ok: true });
    expect((await c.getBalance(userId)).total).toBe(start - 2);
    expect(await c.releaseCredits(userId, "r2")).toBe(true);
    expect(await c.confirmCredits(userId, "r2")).toBe(false);
    expect((await c.getBalance(userId)).total).toBe(start - 1);
  });

  it("동시 요청에도 음수 잔액이 되지 않는다", async () => {
    const left = (await c.getBalance(userId)).total;
    const results = await Promise.all(
      Array.from({ length: left + 5 }, (_, i) => c.reserveCredits(userId, `p${i}`)),
    );
    expect(results.filter((r) => r.ok).length).toBe(left);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "NO_CREDITS")).toBe(true);
    expect((await c.getBalance(userId)).total).toBe(0);
  });

  it("만료된 지급분은 잔액에 포함되지 않는다", async () => {
    await c.grantCredits({
      userId,
      amount: 3,
      creditType: "topup",
      expiresAt: new Date(Date.now() - 1000),
      idempotencyKey: `expired:${userId}`,
    });
    expect((await c.getBalance(userId)).total).toBe(0);
  });
});
