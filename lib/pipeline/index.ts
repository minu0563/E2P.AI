import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { safetyConfig } from "@/system/config";
import { getInferenceClient, models, type ChatResult } from "@/lib/inference";
import { FIELD_KEYS, type Pace, type Profile } from "@/lib/profile";
import {
  ImageAnalysisSchema,
  RequestClassSchema,
  imageAnalysisJsonSchema,
  requestClassJsonSchema,
  type Analysis,
  type RequestClass,
} from "@/system/safety/analysis-schema";
import { decide, precheck, scanTexts, type SafetyConfig } from "@/system/safety/engine";
import { markBlocked, wasBlocked } from "@/system/safety/history";
import { BLOCK_MESSAGES, NEUTRALIZED_NOTICE, type BlockCode } from "@/lib/safety/messages";
import {
  BlocksSchema,
  assemblePrompt,
  blocksJsonSchema,
  checkOutput,
  type Blocks,
  type Fields,
  type KeyActionMode,
} from "./assemble";
import { ANALYSIS_SYSTEM, ANALYSIS_USER, REQUEST_SYSTEM, generationSystem, requestUser } from "@/system/prompts";

const config = safetyConfig as SafetyConfig;

export type PipelineInput = {
  /** 크레딧 예약과 같은 ID를 쓰기 위해 호출 측에서 넘긴다 */
  requestId?: string;
  profile: Profile;
  inputMode: "fields" | "natural";
  request: string;
  fields: Fields;
  placeholder: boolean;
  duration: number;
  aspectRatio: string;
  pace: Pace;
  image: { base64: string; hash: string };
  /** 안전 검사 모드 덮어쓰기 (개발 환경의 테스트 계정만 "shadow") */
  safetyMode?: "shadow";
  /** 진행 단계 알림 (큐 진행 상태 표시용) */
  onStage?: (stage: "analyzing" | "writing") => void;
  /** 사용자가 취소했는지. 분석이 끝난 뒤 확인해 생성 호출을 아낀다 */
  isCancelled?: () => Promise<boolean>;
};

export type PipelineResult =
  | {
      ok: true;
      requestId: string;
      prompt: string;
      /** 항목별 입력 칸 회색 미리보기용 (자동으로 채워진 값) */
      filled: Partial<Fields>;
      notices: string[];
      meta: { shot_type: string; viewpoint: string };
      timings: { totalMs: number };
      debug?: string[];
    }
  | { ok: false; requestId: string; code: BlockCode; message: string; debug?: string[] };

/**
 * 개발 모드 전용 내부 원인 표시. 운영(NODE_ENV=production)에서는 응답에 아예 넣지 않는다
 * (판정 라벨·키워드 노출은 우회에 악용될 수 있음 — CLAUDE.md 6.5).
 */
// 워커는 NODE_ENV가 비어 있을 수 있으므로 명시적으로 켠 경우만 (SAFETY_DEBUG=1, 운영에서는 절대 켜지 않는다)
const DEV = process.env.NODE_ENV !== "production" && process.env.SAFETY_DEBUG === "1";

function debugLines(
  code: BlockCode | null,
  stages: Record<string, unknown>[],
  a: Analysis | null,
  scan: ReturnType<typeof scanTexts>,
  totalMs: number,
): string[] {
  const out: string[] = [];
  if (code) out.push(`code: ${code}`);
  const hits = Object.entries(scan).filter(([, v]) => v.length);
  if (hits.length) out.push(`키워드: ${hits.map(([k, v]) => `${k}=[${v.join(", ")}]`).join(" ")}`);
  if (a) {
    out.push(
      `분석: ${a.image_type}, 인물 ${a.person_count}명${a.person_centric ? "(중심)" : ""}, 연령=${a.age_assessment}(추정 ${a.estimated_age}세, 근거=[${a.minor_cues.join(", ")}]),이미지수위=${a.sexual_content}, 요청수위=${a.request_level}, 제3자=${a.third_party_claim}`,
    );
  }
  for (const s of stages) {
    if ("error" in s) out.push(`${s.stage} 오류: ${String(s.error).slice(0, 160)}`);
    else if ("violations" in s) out.push(`${s.stage}: ${(s.violations as string[]).join(", ")}`);
    else if (s.stage === "analysis_parse" && !s.head) out.push("분석 출력이 비어 있음 (생각 토큰이 한도를 다 씀)");
    else if ("model" in s) {
      out.push(`${s.stage}: ${s.model} 출력 ${s.outputTokens}토큰, ${(Number(s.totalMs) / 1000).toFixed(1)}초 (로드 ${(Number(s.loadMs ?? 0) / 1000).toFixed(1)}초)`);
    }
  }
  out.push(`총 ${(totalMs / 1000).toFixed(1)}초`);
  return out;
}

const guideCache = new Map<string, string>();
async function loadGuide(profile: Profile) {
  if (!guideCache.has(profile.guide)) {
    // 경로를 system/guides/ 폴더로 한정해 빌드 추적 범위를 좁힌다
    const rel = path.relative("system/guides", profile.guide);
    const raw = await readFile(path.join(process.cwd(), "system", "guides", rel), "utf8");
    guideCache.set(profile.guide, raw.replace(/<!--[\s\S]*?-->/g, "").trim());
  }
  return guideCache.get(profile.guide)!;
}

/** 텍스트·메타데이터만 로그 (이미지 원본·시스템 프롬프트 금지). TODO(DB 단계): 테이블로 저장 */
function log(entry: Record<string, unknown>) {
  console.log(`[pipeline] ${JSON.stringify(entry)}`);
}

function stageLog(name: string, r: ChatResult) {
  return { stage: name, model: r.model, provider: r.provider, ...r.usage, ...r.timings, chars: r.content.length };
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const requestId = input.requestId ?? randomUUID();
  const t0 = Date.now();
  const stages: Record<string, unknown>[] = [];
  const { profile } = input;
  const client = getInferenceClient();

  let analysis: Analysis | null = null;
  const scan = scanTexts([input.request, ...FIELD_KEYS.map((k) => input.fields[k])]);

  const fail = (code: BlockCode, extra: Record<string, unknown> = {}): PipelineResult => {
    if (code === "SEXUAL_REQUEST" || code === "THIRD_PARTY_CLAIM") {
      markBlocked(input.image.hash).catch((e) => console.error("[pipeline] markBlocked failed", String(e).slice(0, 200)));
    }
    log({ requestId, outcome: "block", code, profile: profile.profile, inputMode: input.inputMode, stages, totalMs: Date.now() - t0, ...extra });
    return {
      ok: false,
      requestId,
      code,
      message: BLOCK_MESSAGES[code],
      ...(DEV && { debug: debugLines(code, stages, analysis, scan, Date.now() - t0) }),
    };
  };

  // [4a] 모든 입력칸을 같은 키워드 검사에 (모델 호출 전)
  const pre = precheck(scan);
  if (pre) return fail(pre, { scan });

  // 우회 루프 차단
  if (input.placeholder && (await wasBlocked(input.image.hash))) {
    return fail("MODE_RESTRICTED", { bypassAttempt: true });
  }

  input.onStage?.("analyzing");

  // [3] 이미지 분석(Qwen, 이미지만)과 요청 분류(생성 모델, 텍스트만)를 동시에. 하나라도 실패하면 fail-closed
  const analyzeImage = async () => {
    try {
      const r = await client.chat({
        model: models.analysis(),
        system: ANALYSIS_SYSTEM,
        user: ANALYSIS_USER,
        images: [input.image.base64],
        schema: imageAnalysisJsonSchema,
        temperature: 0,
        // instruct 변형 기준 출력 약 170토큰. thinking 변형을 쓰면 ANALYSIS_MAX_TOKENS를 2500 이상으로
        maxTokens: Number(process.env.ANALYSIS_MAX_TOKENS ?? 800),
      });
      stages.push(stageLog("analysis", r));
      try {
        return ImageAnalysisSchema.parse(JSON.parse(r.content));
      } catch (e) {
        stages.push({ stage: "analysis_parse", head: r.content.slice(0, 120), tail: r.content.slice(-200) });
        throw e;
      }
    } catch (e) {
      stages.push({ stage: "analysis", error: String(e).slice(0, 300) });
      return null;
    }
  };
  const classifyRequest = async (): Promise<RequestClass | null> => {
    const texts = [input.request, ...FIELD_KEYS.map((k) => input.fields[k])].filter((t) => t.trim());
    if (!texts.length) return { request_level: "general", third_party_claim: false }; // 받은 글이 없다
    try {
      const r = await client.chat({
        model: models.generation(),
        system: REQUEST_SYSTEM,
        user: requestUser({ request: input.request, fields: input.fields }),
        schema: requestClassJsonSchema,
        temperature: 0,
        maxTokens: 100,
        // 생성 호출과 같은 컨텍스트 크기여야 Ollama가 모델을 다시 올리지 않는다
        contextTokens: Number(process.env.GENERATION_NUM_CTX ?? 16384),
      });
      stages.push(stageLog("request", r));
      return RequestClassSchema.parse(JSON.parse(r.content));
    } catch (e) {
      stages.push({ stage: "request", error: String(e).slice(0, 300) });
      return null;
    }
  };
  const [img, req] = await Promise.all([analyzeImage(), classifyRequest()]);
  analysis = img && req ? { ...img, ...req } : null;

  // [4b] 규칙 엔진
  const cfg: SafetyConfig = input.safetyMode === "shadow" ? { ...config, mode: "shadow" } : config;
  const decision = decide(analysis, scan, cfg, { placeholder: input.placeholder });
  if (decision.action === "block") return fail(decision.code!, { decision: decision.internal });
  const neutralize = decision.action === "neutralize";
  const a = analysis!;
  if (await input.isCancelled?.()) return fail("SYSTEM_ERROR", { cancelled: true });
  input.onStage?.("writing");

  // [5] 프롬프트 생성 — 플레이스홀더 모드면 핵심 동작은 받지도 생성하지도 않는다
  const keyMode: KeyActionMode = input.placeholder
    ? "placeholder"
    : input.fields.key_action.trim()
      ? "user"
      : "auto";

  const guide = await loadGuide(profile);
  const userFields = Object.fromEntries(
    FIELD_KEYS.filter((k) => input.fields[k].trim()).map((k) => [k, input.fields[k].trim()]),
  );
  const payload = {
    key_action_mode: keyMode,
    duration_seconds: input.duration,
    pace: input.pace,
    request: input.request,
    user_fields: userFields,
    image_facts: {
      image_type: a.image_type,
      person_centric: a.person_centric,
      person_count: a.person_count,
      shot_type: a.shot_type,
      viewpoint: a.viewpoint,
      subject: a.subject,
      scene: a.scene,
      clothing: a.appearance,
      pose: a.pose,
      composition: a.composition,
      lighting: a.lighting,
      visible_body_parts: a.visible_body_parts,
      not_visible_body_parts: a.not_visible_body_parts,
    },
    ...((neutralize || decision.ageAmbiguous) && {
      note: decision.ageAmbiguous
        ? "Describe only everyday, non-sexual actions with neutral wording. Do not describe the body, do not change or reveal clothing, keep the outfit exactly as in the image."
        : "Describe every motion and outfit in neutral, everyday, non-sexual terms. Drop any sexualized nuance from the request.",
    }),
  };
  const ctx = {
    duration: input.duration,
    aspectRatio: input.aspectRatio,
    personCentric: a.person_centric && a.person_count > 0,
    imageType: a.image_type,
    keyMode,
    placeholder: profile.placeholder,
    pace: input.pace,
    hasDialogue: !!input.fields.dialogue.trim(),
  };

  const inputWasSuggestive = a.request_level === "suggestive" || scan.suggestive.length > 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await client.chat({
        model: models.generation(),
        system: generationSystem(guide),
        user: JSON.stringify(payload),
        schema: blocksJsonSchema,
        temperature: attempt === 0 ? 0.4 : 0.2,
        maxTokens: 1800,
        contextTokens: Number(process.env.GENERATION_NUM_CTX ?? 16384),
      });
      stages.push(stageLog(`generation#${attempt + 1}`, r));
      let blocks: Blocks;
      try {
        blocks = BlocksSchema.parse(JSON.parse(r.content));
      } catch (e) {
        stages.push({ stage: `parse#${attempt + 1}`, error: String(e).slice(0, 200), head: r.content.slice(0, 120), tail: r.content.slice(-80) });
        continue;
      }
      const prompt = assemblePrompt(blocks, ctx);

      // [6] 출력 검사
      const violations = checkOutput({ profile, prompt, mode: keyMode, inputWasSuggestive });
      if (violations.length) {
        stages.push({ stage: `output_check#${attempt + 1}`, violations });
        continue;
      }

      const totalMs = Date.now() - t0;
      // [7] 로그
      log({
        requestId,
        outcome: decision.action,
        shadowWouldBe: decision.wouldBe,
        profile: profile.profile,
        inputMode: input.inputMode,
        keyMode,
        requestText: input.request,
        stages,
        totalMs,
        credit_cost: 1,
      });
      return {
        ok: true,
        requestId,
        prompt,
        filled: {
          scene: blocks.location,
          appearance: a.appearance,
          ...(keyMode === "auto" && { key_action: blocks.event }),
          camera: blocks.camera || "원본 구도 유지",
          lighting: blocks.lighting,
          audio: blocks.audio,
        },
        notices: neutralize ? [NEUTRALIZED_NOTICE] : [],
        meta: { shot_type: a.shot_type, viewpoint: a.viewpoint },
        timings: { totalMs },
        ...(DEV && {
          debug: [
            `${decision.action}${decision.ageAmbiguous ? " (연령 애매 → 일상 요청이라 조건부 허용)" : ""}${decision.wouldBe.action !== decision.action ? ` (shadow: enforce였다면 ${decision.wouldBe.action} ${decision.wouldBe.code ?? ""})` : ""}`,
            ...debugLines(null, stages, a, scan, totalMs),
          ],
        }),
      };
    } catch (e) {
      stages.push({ stage: `generation#${attempt + 1}`, error: String(e).slice(0, 300) });
    }
  }
  const lastErr = stages.at(-1);
  return fail(lastErr && "violations" in lastErr ? "OUTPUT_FILTER" : "SYSTEM_ERROR");
}
