import "server-only";
import { addUsage, emptyUsage, recordUsage, type Usage } from "@/lib/ai-budget";
import { CREDIT_CONFIG, confirmCredits, getBalance, releaseCredits, settleBlocked } from "@/lib/credits";
import { db } from "@/lib/db";
import type { HistoryInput } from "@/lib/history";
import { releaseSlot } from "@/lib/limits";
import { runPipeline, type PipelineInput, type PipelineResult } from "@/lib/pipeline";
import type { Profile } from "@/lib/profile";
import { BLOCK_MESSAGES } from "@/lib/safety/messages";

/**
 * 생성 한 건을 요청 안에서 끝까지 처리한다 (큐·워커 없음, Workers 대응).
 * 크레딧: 성공 → 확정 / 차단 → 하루 무료 횟수 뒤 차감 / 오류·취소 → 반환.
 * 예외를 밖으로 던지지 않는다(크레딧은 항상 정산). 비정상 종료로 정산이 빠지면 예약 자동 반환이 처리한다.
 */
export type GenerationJob = {
  requestId: string;
  userId: string;
  /** 테스트 계정: 크레딧 예약 없음, safetyShadow면 안전 검사 shadow(개발 환경만) */
  test?: { safetyShadow: boolean };
  profile: Profile;
  input: Omit<PipelineInput, "image" | "profile" | "requestId" | "onStage" | "isCancelled" | "safetyMode">;
  image: PipelineInput["image"];
  savedInput: HistoryInput;
};

export type GenerationResult =
  | (PipelineResult & { balance?: number; creditNotice?: "blockFee" | "blockWarn" | null })
  | { ok: false; code: "CANCELLED"; message: string };

async function writeLog(
  j: GenerationJob,
  outcome: "ok" | "block" | "error" | "cancel",
  blockCode: string | null,
  creditCost: number,
  usage: Usage,
  prompt?: string,
) {
  await db.generationLog
    .create({
      data: {
        requestId: j.requestId,
        userId: j.userId,
        mode: j.input.inputMode,
        profile: j.profile.profile,
        requestText: j.input.request,
        outcome,
        blockCode,
        creditCost,
        prompt: prompt ?? null,
        input: j.savedInput,
        model: usage.model,
        aiCalls: usage.calls,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costMicroUsd: usage.costMicroUsd,
      },
    })
    .catch((e) => console.error("[log] write failed", String(e).slice(0, 200)));
}

export async function runGeneration(
  j: GenerationJob,
  opts: { onStage?: (s: "analyzing" | "writing") => void; isCancelled: () => boolean },
): Promise<GenerationResult> {
  const cost = CREDIT_CONFIG.cost.generate;
  const usage = emptyUsage();
  const cancelled = async (): Promise<GenerationResult> => {
    await releaseCredits(j.userId, j.requestId, "cancel");
    await writeLog(j, "cancel", null, 0, usage);
    return { ok: false, code: "CANCELLED", message: "cancelled" };
  };
  try {
    const result = await runPipeline({
      ...j.input,
      requestId: j.requestId,
      profile: j.profile,
      image: j.image,
      safetyMode: j.test?.safetyShadow ? "shadow" : undefined,
      onStage: opts.onStage,
      onUsage: (r) => addUsage(usage, r),
      isCancelled: async () => opts.isCancelled(),
    });
    if (opts.isCancelled()) return await cancelled();

    let creditNotice: "blockFee" | "blockWarn" | null = null;
    if (result.ok) {
      await confirmCredits(j.userId, j.requestId);
      await writeLog(j, "ok", null, j.test ? 0 : cost, usage, result.prompt);
    } else {
      const s = await settleBlocked(j.userId, j.requestId, result.code);
      creditNotice = s.blockFee ? "blockFee" : s.blockWarn ? "blockWarn" : null;
      await writeLog(j, "block", result.code, s.blockFee ? cost : 0, usage);
    }
    const { total } = await getBalance(j.userId);
    return { ...result, balance: total, creditNotice };
  } catch (e) {
    console.error("[generate] unexpected", String(e).slice(0, 300));
    await releaseCredits(j.userId, j.requestId, "error").catch(() => {});
    await writeLog(j, "error", "SYSTEM_ERROR", 0, usage);
    return { ok: false, requestId: j.requestId, code: "SYSTEM_ERROR", message: BLOCK_MESSAGES.SYSTEM_ERROR };
  } finally {
    // 결과와 관계없이 쓴 만큼 예산에 더한다 (차단·오류·취소도 AI 비용은 나갔다)
    await recordUsage(usage).catch((e) => console.error("[budget] record failed", String(e).slice(0, 200)));
    await releaseSlot(j.userId, j.requestId).catch(() => {});
  }
}
