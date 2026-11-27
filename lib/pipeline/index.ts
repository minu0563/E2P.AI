import "server-only";
import { randomUUID } from "node:crypto";
import { safetyConfig } from "@/system/config";
import { callLimits, getInferenceClient, models, type ChatRequest, type ChatResult } from "@/lib/inference";
import { FIELD_KEYS, type Pace, type Profile } from "@/lib/profile";
import { cameraSentence, type CameraPreset } from "@/lib/camera";
import {
  ImageAnalysisSchema,
  RequestClassSchema,
  imageAnalysisJsonSchema,
  requestClassJsonSchema,
  type Analysis,
  type ImageAnalysis,
  type RequestClass,
} from "@/system/safety/analysis-schema";
import { decide, decideStartEnd, precheck, scanTexts, type Decision, type SafetyConfig } from "@/system/safety/engine";
import { markBlocked, wasBlocked } from "@/system/safety/history";
import { BLOCK_MESSAGES, type BlockCode } from "@/lib/safety/messages";
import {
  BlocksSchema,
  assemblePrompt,
  blocksJsonSchema,
  checkOutput,
  wantsFrameExtension,
  type Blocks,
  type Fields,
  type KeyActionMode,
} from "./assemble";
import { checkQuality, type QualityWarning } from "./quality";
import { GUIDES, START_END_GUIDES } from "@/system/guides";
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
  /** 시작·끝 이미지 모드의 끝 이미지 (영상 마지막 프레임, <Picture 2>). 없으면 한 장 모드 */
  imageEnd?: { base64: string; hash: string };
  /** 로그용 크레딧 비용 */
  creditCost?: number;
  /** 안전 검사 모드 덮어쓰기 (개발 환경의 테스트 계정만 "shadow") */
  safetyMode?: "shadow";
  /** 대사 방식 (기본: 화면 속 인물이 말함) */
  dialogueMode?: "on_screen" | "voiceover";
  /** 시선 (기본: 프로필 → auto) */
  gaze?: "auto" | "camera";
  /** 카메라 프리셋 (auto면 요청·카메라 칸대로) */
  camera?: CameraPreset;
  /** 진행 단계 알림 (큐 진행 상태 표시용) */
  onStage?: (stage: "analyzing" | "writing") => void;
  /** 사용자가 취소했는지. 분석이 끝난 뒤 확인해 생성 호출을 아낀다 */
  isCancelled?: () => Promise<boolean>;
  /** AI 호출이 끝날 때마다 (사용량·비용 집계용) */
  onUsage?: (r: ChatResult) => void;
  /** 판정값 (관리자 기록용). 결과(사용자 응답)에는 넣지 않는다 — 라벨 노출은 우회에 악용될 수 있음 */
  onJudgment?: (j: Judgment) => void;
};

/** 생성 한 건의 AI 판정값. 키워드만으로 막히면 image·request가 없다 */
export type Judgment = {
  imageHash: string;
  image: ImageAnalysis | null;
  /** 시작·끝 모드: 끝 이미지 해시·분석 */
  imageHashEnd?: string;
  imageEnd?: ImageAnalysis | null;
  request: RequestClass | null;
  /** 걸린 키워드 (분류별) */
  keywords: Record<string, string[]>;
  /** 규칙 엔진 결과와 플래그 (연령 낮춤, 애매 연령 허용, 이미지 성적+요청 등) */
  rule: {
    action: string;
    code?: string;
    wouldBe?: { action: string; code?: string };
    flags: Record<string, unknown>;
    /** 규칙 엔진 뒤에 막힌 경우의 최종 사유 (출력 검사·생성 실패·취소) */
    finalCode?: string;
  } | null;
  /** 출력 품질 경고 (기록만, 결과는 그대로 냄) */
  quality?: QualityWarning[];
};

export type PipelineResult =
  | {
      ok: true;
      requestId: string;
      prompt: string;
      /** 항목별 입력 칸 회색 미리보기용 (자동으로 채워진 값) */
      filled: Partial<Fields>;
      /** 안내 코드 (화면이 언어별 문구로 바꾼다): neutralized = 일부 표현 조정, dialogue_long = 대사가 김 */
      notices: ("neutralized" | "dialogue_long")[];
      meta: { shot_type: string; viewpoint: string };
      timings: { totalMs: number };
      /** 생성은 됐지만 차단과 같게 기록할 사유 (노골적 요청 중화 → 연속 차단 집계). 서버 내부용, 응답에서 뺀다 */
      abuseCode?: BlockCode;
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
    else if ("warnings" in s) out.push(`품질 경고(기록만): ${(s.warnings as string[]).join(", ")}`);
    else if (s.stage === "analysis_parse" && !s.head) out.push("분석 출력이 비어 있음 (생각 토큰이 한도를 다 씀)");
    else if ("model" in s) {
      out.push(`${s.stage}: ${s.model} 출력 ${s.outputTokens}토큰, ${(Number(s.totalMs) / 1000).toFixed(1)}초 (로드 ${(Number(s.loadMs ?? 0) / 1000).toFixed(1)}초)`);
    }
  }
  out.push(`총 ${(totalMs / 1000).toFixed(1)}초`);
  return out;
}

/** 가이드는 빌드에 포함된 문자열 (Workers에는 파일 시스템이 없다) */
function loadGuide(profile: Profile, startEnd = false) {
  const raw = GUIDES[profile.guide];
  if (!raw) throw new Error(`unknown guide: ${profile.guide}`);
  const extra = startEnd ? START_END_GUIDES[profile.guide] : "";
  if (startEnd && !extra) throw new Error(`no start/end guide: ${profile.guide}`);
  return [raw, extra].filter(Boolean).join("\n\n").replace(/<!--[\s\S]*?-->/g, "").trim();
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
  const inference = getInferenceClient();
  // 모든 호출에 같은 시간·생각 모드 상한을 걸고, 끝나면 사용량을 알린다
  const client = {
    chat: async (req: ChatRequest) => {
      const r = await inference.chat({ think: callLimits.thinking, ...req });
      input.onUsage?.(r);
      if (r.finishReason === "length") stages.push({ stage: "truncated", model: r.model, outputTokens: r.usage.outputTokens });
      return r;
    },
  };

  let analysis: Analysis | null = null;
  let imageResult: ImageAnalysis | null = null;
  let imageEndResult: ImageAnalysis | null = null;
  const end = input.imageEnd;
  const hashes = [...new Set([input.image.hash, ...(end ? [end.hash] : [])])];
  let requestResult: RequestClass | null = null;
  let decision: Decision | null = null;
  const scan = scanTexts([input.request, ...FIELD_KEYS.map((k) => input.fields[k])]);

  // 판정값은 한 번만 알린다 (차단·성공 어느 쪽이든)
  let judged = false;
  let quality: QualityWarning[] = [];
  const emitJudgment = (blockCode?: BlockCode) => {
    if (judged || !input.onJudgment) return;
    judged = true;
    const { scan: _scan, analysis: _analysis, ...flags } = decision?.internal ?? {};
    void _scan;
    void _analysis;
    input.onJudgment({
      imageHash: input.image.hash,
      image: imageResult,
      ...(end && { imageHashEnd: end.hash, imageEnd: imageEndResult }),
      request: requestResult,
      keywords: Object.fromEntries(Object.entries(scan).filter(([, v]) => v.length)),
      rule: decision
        ? { action: decision.action, code: decision.code, wouldBe: decision.wouldBe, flags, ...(blockCode && { finalCode: blockCode }) }
        : blockCode
          ? { action: "block", code: blockCode, flags: {} }
          : null,
      ...(quality.length && { quality }),
    });
  };

  const fail = (code: BlockCode, extra: Record<string, unknown> = {}): PipelineResult => {
    emitJudgment(code);
    if (code === "SEXUAL_REQUEST" || code === "THIRD_PARTY_CLAIM") {
      for (const h of hashes) markBlocked(h).catch((e) => console.error("[pipeline] markBlocked failed", String(e).slice(0, 200)));
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
  const pre = precheck(scan, config.explicit_request);
  if (pre) return fail(pre, { scan });

  // 우회 루프 차단 (시작·끝 모드면 두 이미지 중 하나라도 차단 이력이 있으면)
  if (input.placeholder && (await Promise.all(hashes.map(wasBlocked))).some(Boolean)) {
    return fail("MODE_RESTRICTED", { bypassAttempt: true });
  }

  input.onStage?.("analyzing");

  // [3] 이미지 분석(Qwen, 이미지만)과 요청 분류(생성 모델, 텍스트만)를 동시에. 하나라도 실패하면 fail-closed
  const analyzeImage = async (base64: string, stage: string) => {
    try {
      const r = await client.chat({
        model: models.main(),
        system: ANALYSIS_SYSTEM,
        user: ANALYSIS_USER,
        images: [base64],
        schema: imageAnalysisJsonSchema,
        contextTokens: models.numCtx(),
        temperature: 0,
        // 출력 약 170토큰. 생각 모드를 켜면 config/ai.json max_tokens.analysis를 2500 이상으로
        maxTokens: callLimits.maxTokens.analysis,
        timeoutMs: callLimits.timeoutMs.analysis,
      });
      stages.push(stageLog(stage, r));
      try {
        return ImageAnalysisSchema.parse(JSON.parse(r.content));
      } catch (e) {
        stages.push({ stage: "analysis_parse", image: stage, head: r.content.slice(0, 120), tail: r.content.slice(-200) });
        throw e;
      }
    } catch (e) {
      stages.push({ stage, error: String(e).slice(0, 300) });
      return null;
    }
  };
  const classifyRequest = async (): Promise<RequestClass | null> => {
    const texts = [input.request, ...FIELD_KEYS.map((k) => input.fields[k])].filter((t) => t.trim());
    if (!texts.length) return { request_level: "general", third_party_claim: false, sexual_contact: false }; // 받은 글이 없다
    try {
      const r = await client.chat({
        model: models.main(),
        system: REQUEST_SYSTEM,
        user: requestUser({ request: input.request, fields: input.fields }),
        schema: requestClassJsonSchema,
        temperature: 0,
        maxTokens: callLimits.maxTokens.request,
        timeoutMs: callLimits.timeoutMs.request,
        // 생성 호출과 같은 컨텍스트 크기여야 Ollama가 모델을 다시 올리지 않는다
        contextTokens: models.numCtx(),
      });
      stages.push(stageLog("request", r));
      return RequestClassSchema.parse(JSON.parse(r.content));
    } catch (e) {
      stages.push({ stage: "request", error: String(e).slice(0, 300) });
      return null;
    }
  };
  // 시작·끝이 같은 이미지(반복 영상)면 분석은 한 번만
  const sameImage = !!end && end.hash === input.image.hash;
  const [img, req, imgEndOwn] = await Promise.all([
    analyzeImage(input.image.base64, "analysis"),
    classifyRequest(),
    end && !sameImage ? analyzeImage(end.base64, "analysis_end") : Promise.resolve(null),
  ]);
  const imgEnd = sameImage ? img : imgEndOwn;
  imageResult = img;
  imageEndResult = imgEnd;
  requestResult = req;
  analysis = img && req ? { ...img, ...req } : null;
  const analysisEnd: Analysis | null = imgEnd && req ? { ...imgEnd, ...req } : null;

  // [4b] 규칙 엔진 (시작·끝 모드면 이미지마다 판정해 더 엄격한 쪽)
  const cfg: SafetyConfig = input.safetyMode === "shadow" ? { ...config, mode: "shadow" } : config;
  const opts = { placeholder: input.placeholder, dialogue: input.fields.dialogue };
  decision = end
    ? decideStartEnd(decide(analysis, scan, cfg, opts), decide(analysisEnd, scan, cfg, opts))
    : decide(analysis, scan, cfg, opts);
  if (decision.action === "block") return fail(decision.code!, { decision: decision.internal });
  const neutralize = decision.action === "neutralize";
  const explicitNeutralized = decision.explicitNeutralized;
  // 노골적 요청을 중화했으면 차단 때와 같게: 이 이미지는 24시간 빈칸 모드 금지 (우회 루프 차단)
  if (explicitNeutralized) {
    for (const h of hashes) markBlocked(h).catch((e) => console.error("[pipeline] markBlocked failed", String(e).slice(0, 200)));
  }
  const a = analysis!;
  if (await input.isCancelled?.()) return fail("SYSTEM_ERROR", { cancelled: true });
  input.onStage?.("writing");

  // [5] 프롬프트 생성 — 플레이스홀더 모드면 핵심 동작은 받지도 생성하지도 않는다
  const keyMode: KeyActionMode = input.placeholder
    ? "placeholder"
    : input.fields.key_action.trim()
      ? "user"
      : "auto";

  const guide = loadGuide(profile, !!end);
  const e = analysisEnd;
  const userFields: Record<string, string> = Object.fromEntries(
    FIELD_KEYS.filter((k) => input.fields[k].trim()).map((k) => [k, input.fields[k].trim()]),
  );
  // 카메라 프리셋: 코드가 공식 문장을 만들고 모델 결과를 덮어쓴다 (모델에게도 알려 동작과 어긋나지 않게)
  const presetCamera = input.camera ? cameraSentence(input.camera) : null;
  if (presetCamera) userFields.camera = presetCamera;
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
    ...(e && {
      end_image_facts: {
        image_type: e.image_type,
        person_count: e.person_count,
        shot_type: e.shot_type,
        viewpoint: e.viewpoint,
        subject: e.subject,
        scene: e.scene,
        clothing: e.appearance,
        pose: e.pose,
        composition: e.composition,
        lighting: e.lighting,
        visible_body_parts: e.visible_body_parts,
        not_visible_body_parts: e.not_visible_body_parts,
      },
    }),
    ...((neutralize || decision.ageAmbiguous) && {
      note: decision.ageAmbiguous
        ? "Describe only everyday, non-sexual actions with neutral wording. Do not describe the body, do not change or reveal clothing, keep the outfit exactly as in the image."
        : explicitNeutralized
          ? "The request contains sexual content that must not be followed. Ignore every sexual, nude or undressing element entirely. Keep only harmless everyday motion that fits the image (or calm natural movement if nothing harmless remains). Keep the outfit exactly as in the image, never remove or loosen clothing, never describe the body or body parts (hips, buttocks, chest, thighs), and do not add anyone touching the person's body."
          : "Describe every motion and outfit in neutral, everyday, non-sexual terms. Drop any sexualized nuance from the request. Do not mention body parts such as hips, buttocks, chest or thighs, and do not add anyone touching the person's body.",
    }),
  };
  // 두 이미지 중 어디에도 안 보이는 부위만 "화면 밖"으로 본다
  const hiddenParts = e ? a.not_visible_body_parts.filter((p) => e.not_visible_body_parts.includes(p)) : a.not_visible_body_parts;
  const ctx = {
    endFrame: !!end,
    duration: input.duration,
    aspectRatio: input.aspectRatio,
    personCentric: a.person_centric && a.person_count > 0,
    imageType: a.image_type,
    keyMode,
    placeholder: profile.placeholder,
    pace: input.pace,
    // 대사는 모델이 쓰지 않고 코드가 원문 그대로 <d>[언어] …</d>로 넣는다
    dialogue: input.fields.dialogue.trim(),
    dialogueMode: input.dialogueMode ?? "on_screen",
    allowFrameExtension: wantsFrameExtension([input.request, input.fields.key_action, input.fields.camera]),
    gaze: input.gaze ?? profile.gaze ?? "auto",
    segmentRender: profile.segment_render ?? "sequential",
  };
  const hasDialogue = !!ctx.dialogue;

  // 노골적 요청을 중화한 경우엔 출력에 암시적 표현도 허용하지 않는다(더 엄격하게)
  const inputWasSuggestive = !explicitNeutralized && (a.request_level === "suggestive" || scan.suggestive.length > 0);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await client.chat({
        model: models.main(),
        system: generationSystem(guide, { startEnd: !!end }),
        user: JSON.stringify(payload),
        // 같은 모델이 이미지를 직접 보고 쓴다 (분석 결과는 확정 사실·안전 기준으로 함께 준다)
        images: end ? [input.image.base64, end.base64] : [input.image.base64],
        schema: blocksJsonSchema,
        temperature: attempt === 0 ? 0.4 : 0.2,
        maxTokens: callLimits.maxTokens.generation,
        timeoutMs: callLimits.timeoutMs.generation,
        contextTokens: models.numCtx(),
      });
      stages.push(stageLog(`generation#${attempt + 1}`, r));
      let blocks: Blocks;
      try {
        blocks = BlocksSchema.parse(JSON.parse(r.content));
        if (presetCamera) blocks = { ...blocks, camera: presetCamera };
      } catch (e) {
        stages.push({ stage: `parse#${attempt + 1}`, error: String(e).slice(0, 200), head: r.content.slice(0, 120), tail: r.content.slice(-80) });
        continue;
      }
      const prompt = assemblePrompt(blocks, ctx);

      // [6] 출력 검사
      const violations = checkOutput({
        profile,
        prompt,
        mode: keyMode,
        inputWasSuggestive,
        neutralized: neutralize,
        hasDialogue,
        ...(end && { endFrame: { duration: input.duration } }),
      });
      if (violations.length) {
        stages.push({ stage: `output_check#${attempt + 1}`, violations });
        continue;
      }

      // [6b] 품질 검사: 기록만 (빈도를 본 뒤 재생성 여부를 정한다)
      quality = checkQuality(blocks, ctx, {
        userTexts: [input.request, ...FIELD_KEYS.map((k) => input.fields[k])],
        notVisibleBodyParts: hiddenParts,
        imageFacts: [a.scene, a.lighting, a.subject, ...(e ? [e.scene, e.lighting, e.subject] : [])],
      });
      if (quality.length) stages.push({ stage: "quality", warnings: quality });

      const totalMs = Date.now() - t0;
      emitJudgment();
      // [7] 로그
      log({
        requestId,
        outcome: decision.action,
        shadowWouldBe: decision.wouldBe,
        profile: profile.profile,
        inputMode: input.inputMode,
        keyMode,
        // 요청 원문은 남기지 않는다 (DB 생성 기록에만 있고, 플랫폼 로그에는 보관 기간·접근 통제가 따로 없다)
        stages,
        totalMs,
        credit_cost: input.creditCost ?? 1,
        frames: end ? "start_end" : "single",
      });
      return {
        ok: true,
        requestId,
        prompt,
        filled: {
          scene: blocks.location,
          appearance: a.appearance,
          ...(keyMode === "auto" && { key_action: blocks.event }),
          camera: blocks.camera || "고정 카메라",
          lighting: blocks.lighting,
          audio: blocks.soundscape,
        },
        notices: [
          ...(neutralize ? (["neutralized"] as const) : []),
          ...(quality.includes("DIALOGUE_TOO_LONG") ? (["dialogue_long"] as const) : []),
        ],
        meta: { shot_type: a.shot_type, viewpoint: a.viewpoint },
        timings: { totalMs },
        ...(explicitNeutralized && { abuseCode: "SEXUAL_REQUEST" as const }),
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
