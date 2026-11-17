/** AI 예산(하루·월·건수)·킬 스위치. 로컬 Postgres 필요, DATABASE_URL이 없으면 건너뛴다 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("AI 예산", async () => {
  const { db } = await import("@/lib/db");
  const B = await import("@/lib/ai-budget");
  const aiConfig = (await import("@/config/ai.json")).default;
  // 실제 날짜와 겹치지 않는 먼 미래
  const day1 = new Date("2099-03-10T12:00:00Z");
  const day2 = new Date("2099-03-11T12:00:00Z");
  const cleanup = () => db.aiUsage.deleteMany({ where: { day: { startsWith: "2099-03" } } });
  beforeAll(cleanup);
  afterAll(cleanup);

  const usage = (costMicroUsd: number) => ({ model: "m", calls: 3, inputTokens: 100, outputTokens: 10, costMicroUsd });

  it("가격 계산: ollama 0, 목록에 없는 모델은 default", () => {
    const u = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
    expect(B.estimateMicroUsd({ provider: "ollama", model: "gemma4:12b", usage: u })).toBe(0);
    expect(B.estimateMicroUsd({ provider: "workers-ai", model: "@cf/google/gemma-4-26b-a4b-it", usage: u })).toBe(400_000);
    expect(B.estimateMicroUsd({ provider: "workers-ai", model: "@cf/unknown", usage: u })).toBe(4_000_000);
  });

  it("호출이 없으면 기록하지 않고, 있으면 원자적으로 더한다", async () => {
    await B.recordUsage(usage(0), day1);
    expect(await db.aiUsage.findUnique({ where: { day: "2099-03-10" } })).toBeNull();
    await Promise.all([B.recordUsage(usage(100), day1), B.recordUsage(usage(200), day1)]);
    const row = await db.aiUsage.findUnique({ where: { day: "2099-03-10" } });
    expect(row).toMatchObject({ calls: 6, generations: 2 });
    expect(Number(row!.costMicroUsd)).toBe(300);
  });

  it("하루 비용 상한을 넘으면 막고, 다음 날은 다시 열린다", async () => {
    expect(await B.checkBudget(day1)).toEqual({ ok: true });
    await B.recordUsage(usage(aiConfig.budget.daily_usd * 1e6), day1);
    expect(await B.checkBudget(day1)).toEqual({ ok: false, reason: "daily_usd" });
    expect(await B.checkBudget(day2)).toEqual({ ok: true });
  });

  it("이번 달 합계 상한", async () => {
    await B.recordUsage(usage(aiConfig.budget.monthly_usd * 1e6), day2);
    expect(await B.checkBudget(day2)).toMatchObject({ ok: false });
    expect(await B.checkBudget(new Date("2099-04-01T00:00:00Z"))).toEqual({ ok: true });
  });

  it("킬 스위치 (GENERATION_DISABLED=1)", async () => {
    process.env.GENERATION_DISABLED = "1";
    try {
      expect(await B.checkBudget(new Date("2099-05-01T00:00:00Z"))).toEqual({ ok: false, reason: "disabled" });
    } finally {
      delete process.env.GENERATION_DISABLED;
    }
  });
});
