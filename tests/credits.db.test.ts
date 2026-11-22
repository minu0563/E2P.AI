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
    expect((await c.confirmCredits(userId, "r1")).settled).toBe(true);
    expect((await c.releaseCredits(userId, "r1")).settled).toBe(false);
    expect((await c.getBalance(userId)).total).toBe(start - 1);

    expect(await c.reserveCredits(userId, "r2")).toEqual({ ok: true });
    expect((await c.getBalance(userId)).total).toBe(start - 2);
    expect((await c.releaseCredits(userId, "r2")).settled).toBe(true);
    expect((await c.confirmCredits(userId, "r2")).settled).toBe(false);
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

run("차단 크레딧·예약 정리 (DB)", async () => {
  const { db } = await import("@/lib/db");
  const c = await import("@/lib/credits");
  const FREE = c.CREDIT_CONFIG.block_fee.free_per_day;
  const COUNTED = c.CREDIT_CONFIG.block_fee.counted_codes[0];
  let userId = "";
  const rid = (s: string) => `${userId}:${s}`;
  const bal = async () => (await c.getBalance(userId)).total;

  beforeAll(async () => {
    const u = await db.user.create({ data: { email: `test-block-${Date.now()}@example.test` } });
    userId = u.id;
    await c.grantCredits({ userId, amount: 100, creditType: "topup", expiresAt: null, idempotencyKey: `t:${userId}` });
  });
  afterAll(async () => {
    await db.creditEntry.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it(`센 차단은 하루 ${FREE}회까지 반환, 마지막 무료 차단에 경고, 그 뒤는 차감`, async () => {
    const start = await bal();
    for (let i = 1; i <= FREE; i++) {
      await c.reserveCredits(userId, rid(`b${i}`));
      const r = await c.settleBlocked(userId, rid(`b${i}`), COUNTED);
      expect(r).toMatchObject({ settled: true, charged: false, blockFee: false, blockWarn: i === FREE });
    }
    expect(await bal()).toBe(start);
    await c.reserveCredits(userId, rid("b-fee"));
    expect(await c.settleBlocked(userId, rid("b-fee"), COUNTED)).toMatchObject({ charged: true, blockFee: true });
    expect(await bal()).toBe(start - 1);
  });

  it("이미지 판정 차단·시스템 오류·취소는 횟수와 상관없이 반환", async () => {
    const start = await bal();
    await c.reserveCredits(userId, rid("age"));
    expect(await c.settleBlocked(userId, rid("age"), "AGE_UNCERTAIN")).toMatchObject({ charged: false });
    await c.reserveCredits(userId, rid("err"));
    expect(await c.releaseCredits(userId, rid("err"))).toMatchObject({ charged: false });
    await c.reserveCredits(userId, rid("cancel"));
    expect(await c.releaseCredits(userId, rid("cancel"), "cancel")).toMatchObject({ charged: false });
    expect(await bal()).toBe(start);
  });

  it("차단 수수료는 하루 성공 상한에 들어가지 않는다", async () => {
    const n = await db.creditEntry.count({
      where: { userId, kind: "confirm", OR: [{ note: null }, { note: "generate" }] },
    });
    expect(n).toBe(0);
  });

  it("날짜가 바뀌면 차단 횟수가 초기화된다", async () => {
    await db.creditEntry.updateMany({
      where: { userId, kind: { in: ["confirm", "release"] } },
      data: { createdAt: new Date(c.dayStart().getTime() - 3_600_000) },
    });
    await c.reserveCredits(userId, rid("next-day"));
    expect(await c.settleBlocked(userId, rid("next-day"), COUNTED)).toMatchObject({ charged: false });
  });

  it("동시에 차단돼도 무료 횟수를 넘겨 반환하지 않는다", async () => {
    await db.creditEntry.updateMany({
      where: { userId, kind: { in: ["confirm", "release"] } },
      data: { createdAt: new Date(c.dayStart().getTime() - 3_600_000) },
    });
    const ids = Array.from({ length: FREE + 4 }, (_, i) => rid(`cc${i}`));
    for (const id of ids) await c.reserveCredits(userId, id);
    const rs = await Promise.all(ids.map((id) => c.settleBlocked(userId, id, COUNTED)));
    expect(rs.filter((r) => !r.charged).length).toBe(FREE);
    expect(rs.filter((r) => r.blockFee).length).toBe(4);
  });

  it(`${c.CREDIT_CONFIG.reservation_ttl_minutes}분 넘게 정산되지 않은 예약은 자동 반환`, async () => {
    const start = await bal();
    await c.reserveCredits(userId, rid("stale"));
    await c.reserveCredits(userId, rid("fresh"));
    expect(await bal()).toBe(start - 2);
    await db.creditEntry.updateMany({
      where: { requestId: rid("stale") },
      data: { createdAt: new Date(Date.now() - (c.CREDIT_CONFIG.reservation_ttl_minutes + 1) * 60_000) },
    });
    expect(await c.releaseStaleReservations(userId)).toBe(1);
    expect(await bal()).toBe(start - 1);
    // 늦게 끝난 요청이 확정을 시도해도 다시 정산되지 않는다
    expect((await c.confirmCredits(userId, rid("stale"))).settled).toBe(false);
    await c.releaseCredits(userId, rid("fresh"));
  });
});

run("월 프로모션 예산", async () => {
  const { db } = await import("@/lib/db");
  const c = await import("@/lib/credits");
  let adminTarget = "";
  let newbie = "";
  beforeAll(async () => {
    adminTarget = (await db.user.create({ data: { email: `test-budget-a-${Date.now()}@example.test` } })).id;
    newbie = (await db.user.create({ data: { email: `test-budget-b-${Date.now()}@example.test` } })).id;
  });
  afterAll(async () => {
    await db.creditEntry.deleteMany({ where: { userId: { in: [adminTarget, newbie] } } });
    await db.user.deleteMany({ where: { id: { in: [adminTarget, newbie] } } });
  });

  it("관리자가 준 프로모션은 가입 지급 예산을 쓰지 않는다", async () => {
    await c.grantCredits({
      userId: adminTarget,
      amount: c.CREDIT_CONFIG.monthly_promo_budget * 2,
      creditType: "promo",
      expiresAt: new Date(Date.now() + 86_400_000),
      idempotencyKey: `admin-test:${adminTarget}`,
      note: "admin: test",
    });
    expect(await c.grantSignupCredits(newbie)).toBe(true);
  });
});

run("하루 무료 지급 (DB)", async () => {
  const { db } = await import("@/lib/db");
  const c = await import("@/lib/credits");
  let u = "";
  let banned = "";
  const DAY = 86_400_000;

  beforeAll(async () => {
    u = (await db.user.create({ data: { email: `daily-${Date.now()}@example.test` } })).id;
    banned = (await db.user.create({ data: { email: `daily-ban-${Date.now()}@example.test`, suspendedAt: new Date() } })).id;
  });
  afterAll(async () => {
    await db.creditEntry.deleteMany({ where: { userId: { in: [u, banned] } } });
    await db.user.deleteMany({ where: { id: { in: [u, banned] } } });
  });

  it("하루 한 번만, 다음 자정에 소멸 (쌓이지 않음)", async () => {
    const amount = c.CREDIT_CONFIG.daily.amount;
    expect(await c.grantDailyCredits(u)).toBe(true);
    expect(await c.grantDailyCredits(u)).toBe(false);
    expect((await c.getBalance(u)).total).toBe(amount);
    const g = await db.creditEntry.findFirstOrThrow({ where: { userId: u, note: "daily" } });
    expect(g.expiresAt?.getTime()).toBe(c.dayStart().getTime() + DAY);
  });

  it("동시에 들어와도 한 번만 지급", async () => {
    const tomorrow = new Date(c.dayStart().getTime() + DAY + 1000);
    const r = await Promise.all(Array.from({ length: 5 }, () => c.grantDailyCredits(u, tomorrow)));
    expect(r.filter(Boolean)).toHaveLength(1);
  });

  it("정지 계정은 지급하지 않는다", async () => {
    expect(await c.grantDailyCredits(banned)).toBe(false);
  });

  it("하루 지급은 가입 지급 예산에 세지 않는다", async () => {
    await c.grantCredits({
      userId: u,
      amount: c.CREDIT_CONFIG.monthly_promo_budget * 2,
      creditType: "promo",
      expiresAt: new Date(Date.now() + DAY),
      idempotencyKey: `daily-budget-test:${u}`,
      note: "daily",
    });
    const fresh = (await db.user.create({ data: { email: `daily-new-${Date.now()}@example.test` } })).id;
    try {
      expect(await c.grantSignupCredits(fresh)).toBe(true);
    } finally {
      await db.creditEntry.deleteMany({ where: { userId: fresh } });
      await db.user.delete({ where: { id: fresh } });
    }
  });
});
