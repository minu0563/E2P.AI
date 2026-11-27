import "server-only";
import type { Prisma } from "@prisma/client";
import { recordBlock, type AbuseNotice } from "@/lib/abuse";
import { addUsage, emptyUsage, recordUsage, type Usage } from "@/lib/ai-budget";
import { decideTier, expiresAt, type ImageTier } from "@/lib/image-retention";
import { deleteImage, putImage, runAfterResponse } from "@/platform/image-store";
import { CREDIT_CONFIG, confirmCredits, getBalance, releaseCredits, settleBlocked } from "@/lib/credits";
import { db } from "@/lib/db";
import type { HistoryInput } from "@/lib/history";
import { releaseSlot } from "@/lib/limits";
import { runPipeline, type Judgment, type PipelineInput, type PipelineResult } from "@/lib/pipeline";
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
  /** 관리자 계정(ADMIN_EMAILS): 생성 기록·이미지를 DB·R2에 남기지 않는다 (관리 화면에 운영자 테스트가 섞이지 않게). 안전 검사·예산 집계는 같다 */
  noRecord?: boolean;
  profile: Profile;
  input: Omit<PipelineInput, "image" | "profile" | "requestId" | "onStage" | "isCancelled" | "safetyMode" | "onUsage" | "onJudgment">;
  image: PipelineInput["image"];
  savedInput: HistoryInput;
};

export type GenerationResult =
  | (PipelineResult & { balance?: number; creditNotice?: "blockFee" | "blockWarn" | null; abuseNotice?: AbuseNotice | null })
  | { ok: false; code: "CANCELLED"; message: string };

async function writeLog(
  j: GenerationJob,
  outcome: "ok" | "block" | "error" | "cancel",
  blockCode: string | null,
  creditCost: number,
  usage: Usage,
  judgment: Judgment | null,
  prompt?: string,
) {
  if (j.noRecord) return;
  const img = judgment?.image;
  const tier = decideTier(outcome, blockCode, judgment);
  const saved = await db.generationLog
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
        imageHash: judgment?.imageHash ?? j.image.hash,
        imageTier: tier,
        imageExpiresAt: tier ? expiresAt(tier) : null,
        ...(img && {
          imageType: img.image_type,
          personCount: img.person_count,
          estimatedAge: img.estimated_age,
          ageAssessment: img.age_assessment,
          minorCues: img.minor_cues,
          sexualContent: img.sexual_content,
        }),
        ...(judgment?.request && {
          requestLevel: judgment.request.request_level,
          thirdPartyClaim: judgment.request.third_party_claim,
        }),
        ...(judgment && {
          judgment: {
            subject: img?.subject ?? null,
            scene: img?.scene ?? null,
            personCentric: img?.person_centric ?? null,
            keywords: judgment.keywords,
            rule: judgment.rule,
            ...(judgment.quality && { quality: judgment.quality }),
          } as Prisma.InputJsonValue,
        }),
      },
    })
    .then(() => true)
    .catch((e) => {
      console.error("[log] write failed", String(e).slice(0, 200));
      return false;
    });
  // 기록이 있어야 관리자 화면에서 찾을 수 있으므로, 기록이 저장된 경우에만 이미지를 보관한다
  if (tier && saved) storeImageLater(j, tier);
}

/** 응답을 늦추지 않게 뒤에서 암호화 저장. 실패해도 생성 결과에는 영향 없음 (이미지 내용은 로그에 남기지 않는다) */
function storeImageLater(j: GenerationJob, tier: ImageTier) {
  const task = (async () => {
    try {
      const ok = await putImage(tier, j.requestId, Buffer.from(j.image.base64, "base64"));
      if (ok) {
        // 저장하는 사이 삭제 요청으로 지워졌으면(imageTier가 비워짐) 방금 올린 것도 지운다
        const r = await db.generationLog.updateMany({
          where: { requestId: j.requestId, imageTier: tier },
          data: { imageStoredAt: new Date() },
        });
        if (r.count === 0) await deleteImage(tier, j.requestId);
      } else console.warn("[image] store unavailable (R2 binding or IMAGE_KEY missing)");
    } catch (e) {
      console.error("[image] store failed", String(e).slice(0, 200));
    }
  })();
  runAfterResponse(task);
}

export async function runGeneration(
  j: GenerationJob,
  opts: { onStage?: (s: "analyzing" | "writing") => void; isCancelled: () => boolean },
): Promise<GenerationResult> {
  const cost = CREDIT_CONFIG.cost.generate;
  const usage = emptyUsage();
  let judgment: Judgment | null = null;
  const cancelled = async (): Promise<GenerationResult> => {
    await releaseCredits(j.userId, j.requestId, "cancel");
    await writeLog(j, "cancel", null, 0, usage, judgment);
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
      onJudgment: (x) => (judgment = x),
      isCancelled: async () => opts.isCancelled(),
    });
    if (opts.isCancelled()) return await cancelled();

    let creditNotice: "blockFee" | "blockWarn" | null = null;
    let abuseNotice: AbuseNotice | null = null;
    if (result.ok) {
      await confirmCredits(j.userId, j.requestId);
      await writeLog(j, "ok", null, j.test ? 0 : cost, usage, judgment, result.prompt);
      // 노골적 요청을 중화해 생성한 경우도 연속 차단 집계에 넣는다 (반복 시도 → 경고·일시 제한)
      if (result.abuseCode && !j.noRecord) {
        abuseNotice = await recordBlock(j.userId, result.abuseCode).catch((e) => {
          console.error("[abuse] record failed", String(e).slice(0, 200));
          return null;
        });
      }
    } else {
      const s = await settleBlocked(j.userId, j.requestId, result.code);
      creditNotice = s.blockFee ? "blockFee" : s.blockWarn ? "blockWarn" : null;
      await writeLog(j, "block", result.code, s.blockFee ? cost : 0, usage, judgment);
      // 연속 차단 단계 조치 (기록을 남기지 않는 관리자 계정은 제외). 실패해도 결과에는 영향 없음
      if (!j.noRecord) {
        abuseNotice = await recordBlock(j.userId, result.code).catch((e) => {
          console.error("[abuse] record failed", String(e).slice(0, 200));
          return null;
        });
      }
    }
    const { total } = await getBalance(j.userId);
    // abuseCode는 내부 집계용 → 응답에 넣지 않는다 (판정 라벨 비노출)
    const { abuseCode: _abuse, ...pub } = result.ok ? result : { ...result, abuseCode: undefined };
    void _abuse;
    return { ...pub, balance: total, creditNotice, abuseNotice };
  } catch (e) {
    console.error("[generate] unexpected", String(e).slice(0, 300));
    await releaseCredits(j.userId, j.requestId, "error").catch(() => {});
    await writeLog(j, "error", "SYSTEM_ERROR", 0, usage, judgment);
    return { ok: false, requestId: j.requestId, code: "SYSTEM_ERROR", message: BLOCK_MESSAGES.SYSTEM_ERROR };
  } finally {
    // 결과와 관계없이 쓴 만큼 예산에 더한다 (차단·오류·취소도 AI 비용은 나갔다)
    await recordUsage(usage).catch((e) => console.error("[budget] record failed", String(e).slice(0, 200)));
    await releaseSlot(j.userId, j.requestId).catch(() => {});
  }
}
