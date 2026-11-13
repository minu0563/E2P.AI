import "server-only";
import type { Job } from "bullmq";
import { confirmCredits, getBalance, releaseCredits, settleBlocked, CREDIT_CONFIG } from "@/lib/credits";
import { db } from "@/lib/db";
import { runPipeline, type PipelineResult } from "@/lib/pipeline";
import { getProfile } from "@/lib/profile";
import { BLOCK_MESSAGES, type BlockCode } from "@/lib/safety/messages";
import { QUEUE_CONFIG, dropImage, isCancelled, releaseSlot, takeImage, type GenerateJobData, type JobStage } from ".";

/** 워커가 돌려주는 결과 = 화면이 받는 응답 */
export type JobResult =
  | (PipelineResult & { balance?: number; creditNotice?: "blockFee" | "blockWarn" | null })
  | { ok: false; code: "CANCELLED"; message: string };

const systemError = (requestId: string): JobResult => ({
  ok: false,
  requestId,
  code: "SYSTEM_ERROR",
  message: BLOCK_MESSAGES.SYSTEM_ERROR,
});

export async function writeLog(
  d: GenerateJobData,
  outcome: "ok" | "block" | "error" | "cancel",
  blockCode: string | null,
  creditCost: number,
  prompt?: string,
) {
  await db.generationLog
    .create({
      data: {
        requestId: d.requestId,
        userId: d.userId,
        mode: d.input.inputMode,
        profile: d.profileId,
        requestText: d.input.request,
        outcome,
        blockCode,
        creditCost,
        prompt: prompt ?? null,
        input: d.savedInput,
      },
    })
    .catch((e) => console.error("[log] write failed", String(e).slice(0, 200)));
}

/** 취소된 요청 정리: 크레딧 반환, 기록 */
export async function finishCancelled(d: GenerateJobData): Promise<JobResult> {
  await releaseCredits(d.userId, d.requestId, "cancel");
  await writeLog(d, "cancel", null, 0);
  return { ok: false, code: "CANCELLED", message: "cancelled" };
}

/**
 * 생성 작업 하나 처리. 예외를 밖으로 던지지 않고 결과로 돌려준다(크레딧은 항상 정산).
 * 크레딧: 성공 → 확정 / 차단 → 하루 무료 횟수 뒤 차감 / 오류·취소·대기 초과 → 반환.
 */
export async function processGenerateJob(job: Job<GenerateJobData>): Promise<JobResult> {
  const d = job.data;
  const cost = CREDIT_CONFIG.cost.generate;
  try {
    if (await isCancelled(d.requestId)) return await finishCancelled(d);

    // 너무 오래 기다린 작업은 처리하지 않는다 (예약 자동 반환과 겹치지 않게)
    if (Date.now() - job.timestamp > QUEUE_CONFIG.max_wait_seconds * 1000) {
      await releaseCredits(d.userId, d.requestId, "error");
      await writeLog(d, "error", "QUEUE_TIMEOUT", 0);
      return systemError(d.requestId);
    }

    const profile = getProfile(d.profileId);
    const image = await takeImage(d.requestId, d.imageHash);
    if (!profile || !image) {
      await releaseCredits(d.userId, d.requestId, "error");
      await writeLog(d, "error", "SYSTEM_ERROR", 0);
      return systemError(d.requestId);
    }

    const result = await runPipeline({
      ...d.input,
      requestId: d.requestId,
      profile,
      image,
      onStage: (stage: JobStage) => void job.updateProgress({ stage }).catch(() => {}),
      isCancelled: () => isCancelled(d.requestId),
    });

    if (await isCancelled(d.requestId)) return await finishCancelled(d);

    let creditNotice: "blockFee" | "blockWarn" | null = null;
    if (result.ok) {
      await confirmCredits(d.userId, d.requestId);
      await writeLog(d, "ok", null, cost, result.prompt);
    } else {
      const s = await settleBlocked(d.userId, d.requestId, result.code as BlockCode);
      creditNotice = s.blockFee ? "blockFee" : s.blockWarn ? "blockWarn" : null;
      await writeLog(d, "block", result.code, s.blockFee ? cost : 0);
    }
    const { total } = await getBalance(d.userId);
    return { ...result, balance: total, creditNotice };
  } catch (e) {
    console.error("[worker] unexpected", String(e).slice(0, 300));
    await releaseCredits(d.userId, d.requestId, "error").catch(() => {});
    await writeLog(d, "error", "SYSTEM_ERROR", 0);
    return systemError(d.requestId);
  } finally {
    await dropImage(d.requestId).catch(() => {});
    await releaseSlot(d.userId, d.requestId).catch(() => {});
  }
}
