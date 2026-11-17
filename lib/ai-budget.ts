import "server-only";
import aiConfig from "@/config/ai.json";
import { db } from "@/lib/db";
import type { ChatResult } from "@/lib/inference";

/**
 * AI 비용 방어 (config/ai.json). Workers AI는 후불이라 상한이 없으므로 코드로 막는다.
 * - 킬 스위치: generation_enabled=false 또는 환경 변수 GENERATION_DISABLED=1 (대시보드에서 배포 없이 즉시)
 * - 예산: 하루·이번 달 추정 비용, 하루 생성 건수. 넘으면 새 생성을 막는다 (테스트 계정 포함)
 * - 판정에 쓰는 DB 조회가 실패하면 막는다 (fail-closed)
 */
type Pricing = { input: number; output: number };
const PRICING = aiConfig.pricing_usd_per_million as Record<string, Pricing>;

export type Usage = { model: string | null; calls: number; inputTokens: number; outputTokens: number; costMicroUsd: number };

export const emptyUsage = (): Usage => ({ model: null, calls: 0, inputTokens: 0, outputTokens: 0, costMicroUsd: 0 });

/** 호출 한 번의 추정 비용(백만분의 1 USD). 로컬 Ollama는 0, 가격표에 없는 모델은 default(비싸게) */
export function estimateMicroUsd(r: Pick<ChatResult, "provider" | "model" | "usage">): number {
  if (r.provider === "ollama") return 0;
  const p = PRICING[r.model] ?? PRICING.default;
  // 100만 토큰당 USD × 토큰 수 = 백만분의 1 USD
  return Math.ceil(r.usage.inputTokens * p.input + r.usage.outputTokens * p.output);
}

export function addUsage(u: Usage, r: ChatResult) {
  u.model ??= r.model;
  u.calls += 1;
  u.inputTokens += r.usage.inputTokens;
  u.outputTokens += r.usage.outputTokens;
  u.costMicroUsd += estimateMicroUsd(r);
}

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

export function generationDisabled(): boolean {
  return aiConfig.generation_enabled === false || process.env.GENERATION_DISABLED === "1";
}

export type BudgetState = { ok: true } | { ok: false; reason: "disabled" | "daily_usd" | "monthly_usd" | "daily_generations" | "error" };

export async function checkBudget(now = new Date()): Promise<BudgetState> {
  if (generationDisabled()) return { ok: false, reason: "disabled" };
  try {
    const day = utcDay(now);
    const month = day.slice(0, 7);
    const [today, monthSum] = await Promise.all([
      db.aiUsage.findUnique({ where: { day } }),
      db.$queryRaw<{ cost: bigint | null }[]>`SELECT sum("costMicroUsd") AS cost FROM "AiUsage" WHERE "day" LIKE ${month + "-%"}`,
    ]);
    const b = aiConfig.budget;
    if (today && Number(today.costMicroUsd) >= b.daily_usd * 1e6) return { ok: false, reason: "daily_usd" };
    if (today && today.generations >= b.daily_generations) return { ok: false, reason: "daily_generations" };
    if (Number(monthSum[0]?.cost ?? 0) >= b.monthly_usd * 1e6) return { ok: false, reason: "monthly_usd" };
    return { ok: true };
  } catch (e) {
    console.error("[budget] check failed", String(e).slice(0, 200));
    return { ok: false, reason: "error" };
  }
}

/** 생성 한 건의 사용량을 오늘 합계에 더한다 (원자적 증가). AI를 한 번도 부르지 않았으면 기록하지 않는다 */
export async function recordUsage(u: Usage, now = new Date()) {
  if (u.calls === 0) return;
  const day = utcDay(now);
  await db.$executeRaw`
    INSERT INTO "AiUsage" ("day", "calls", "generations", "inputTokens", "outputTokens", "costMicroUsd", "updatedAt")
    VALUES (${day}, ${u.calls}, 1, ${u.inputTokens}, ${u.outputTokens}, ${u.costMicroUsd}, now())
    ON CONFLICT ("day") DO UPDATE SET
      "calls" = "AiUsage"."calls" + EXCLUDED."calls",
      "generations" = "AiUsage"."generations" + 1,
      "inputTokens" = "AiUsage"."inputTokens" + EXCLUDED."inputTokens",
      "outputTokens" = "AiUsage"."outputTokens" + EXCLUDED."outputTokens",
      "costMicroUsd" = "AiUsage"."costMicroUsd" + EXCLUDED."costMicroUsd",
      "updatedAt" = now()`;
}
