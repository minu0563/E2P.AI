/**
 * 조립 템플릿 (순수 함수, 테스트 대상).
 * 모델은 블록별 내용(JSON)만 쓰고, 고정 문장·구조·타이밍은 코드가 넣어 빠지지 않게 한다.
 */
import * as z from "zod";
import type { FieldKey, Pace, Profile } from "@/lib/profile";
import { BODY_FOCUS, EXPLICIT, SUGGESTIVE, matchList } from "@/system/safety/keywords";

export type Fields = Record<FieldKey, string>;
export type KeyActionMode = "user" | "placeholder" | "auto";

/** 생성 모델이 채우는 블록 (MiniMax H3 공식 구조에 맞춰 코드가 조립한다) */
export const BlocksSchema = z.object({
  /** 중심 인물 지칭어. 코드가 "the woman in <Picture 1>"처럼 만든다. 사람이 중심이 아니면 none */
  subject_noun: z.enum(["woman", "man", "person", "character", "none"]),
  /** 인물이면 지칭어 뒤에 붙는 복장·소품 서술(얼굴·외모 제외), 인물이 아니면 중심 사물 서술 */
  subject: z.string(),
  /** 구도 (이미지 기준점) */
  composition: z.string(),
  /** 장소·시간대·날씨 */
  location: z.string(),
  lighting: z.string(),
  /** 사용자가 스타일을 말했을 때만. 비우면 코드가 이미지 종류로 정한다 */
  style: z.string(),
  /** 사용자가 카메라를 말했을 때만, 공식 문법의 영어 문장 하나. 비우면 고정 카메라 */
  camera: z.string(),
  keep_original_pose: z.boolean(),
  frame_extension: z.string(),
  /** 핵심 동작 한 줄 요약 (화면 미리보기용, 프롬프트에는 넣지 않음) */
  event: z.string(),
  /** 순서대로 이어지는 동작 서술. 시간은 내부 배분용 (기본 출력은 순서 서술) */
  segments: z.array(z.object({ start: z.number(), end: z.number(), action: z.string() })).min(1).max(6),
  /** 핵심 동작이 일어나는 구간 번호(0부터). 플레이스홀더 모드에서 코드가 이 구간에 빈칸을 넣는다 */
  key_action_segment: z.number().int(),
  /** 대사가 들어갈 구간 번호. 대사가 없으면 -1. 대사 원문은 코드가 넣는다 */
  dialogue_segment: z.number().int(),
  /** 말하는 사람 목소리 묘사(영어, 짧게, 나이 제외). 대사가 없으면 "" */
  voice: z.string(),
  /** 환경음·동작 소리·숨소리 (영어 1~4문장, 대사·노래·음악 제외) */
  soundscape: z.string(),
  /** 사용자가 배경 음악을 원할 때만 (악기·템포·리듬·셈여림). 아니면 "" */
  background_music: z.string(),
});
export type Blocks = z.infer<typeof BlocksSchema>;
export const blocksJsonSchema = z.toJSONSchema(BlocksSchema);

/** I2VA 정렬 문장 (공식 가이드 그대로, 뒤에 빈 줄) */
export const I2VA_ALIGNMENT =
  "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.";

/** FL2VA 정렬 문장 (공식 형식: 여기서는 꺾쇠·대괄호 없이 Picture 1 / Shot 1, 끝 초는 소수 둘째 자리). 샷은 하나 */
export function fl2vaAlignment(duration: number) {
  return `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the ${duration.toFixed(2)}-second mark of the target video.`;
}

/** 시작·끝 모드에서 동작 서술 끝에 코드가 넣는 도착 문장 (<Picture 2>가 반드시 한 번 나오게) */
export const END_FRAME_SENTENCE = "The shot ends on the final frame shown in <Picture 2>.";

export type AssembleContext = {
  /** 시작·끝 이미지 모드 (FL2VA): 정렬 문장이 바뀌고 마지막에 도착 문장이 붙는다 */
  endFrame?: boolean;
  duration: number;
  aspectRatio: string;
  personCentric: boolean;
  imageType: "photo" | "illustration" | "cgi";
  keyMode: KeyActionMode;
  placeholder: string;
  pace?: Pace;
  /** 사용자 대사 원문 (코드가 <d> 블록으로 그대로 넣는다) */
  dialogue?: string;
  /** 대사 방식: 화면 속 인물이 말함 | 보이스오버 */
  dialogueMode?: "on_screen" | "voiceover";
  /** 사용자가 화면 밖 신체(전신·다리·신발 등)나 카메라 확장을 요청했는지. 아니면 프레임 확장 문장을 버린다 */
  allowFrameExtension?: boolean;
  /** 시선: auto = 사용자가 말한 대로(말이 없으면 시선 문장 없음), camera = 렌즈 응시 */
  gaze?: "auto" | "camera";
  /** 샷 안 시간 표기: sequential = 순서 서술(공식 예시 방식), timed = 구간 시간 표기 */
  segmentRender?: "sequential" | "timed";
};

/** 프레임 확장(전신 보이기)을 허용하는 사용자 표현. 없으면 원본 구도 유지 (모델이 멋대로 넓히지 않게) */
const FRAME_EXTENSION_HINT =
  /전신|온몸|다리|발[을이가로]|발끝|신발|구두|하의|바지|치마|무릎|걷|걸어|뛰|달리|점프|줌\s*아웃|멀어|뒤로\s*물러|넓게|full[\s-]?body|\blegs?\b|\bfeet\b|\bshoes\b|\bpants\b|\bskirt\b|\bwalk|\brun|\bjump|zoom(s|ing)?\s*out|pull(s|ing)?\s*back|\bwide\b/i;

export function wantsFrameExtension(texts: string[]) {
  return FRAME_EXTENSION_HINT.test(texts.filter(Boolean).join("\n"));
}

const NONE = /^(none|n\/?a|no( background)? music|없음|-)?\.?$/i;

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  // 문장 첫 글자는 대문자로 ("outdoors, daytime" → "Outdoors, daytime")
  const c = /^[a-z]/.test(t) ? t[0].toUpperCase() + t.slice(1) : t;
  // 대사 블록(</d>)으로 끝나면 마침표를 붙이지 않는다 (원문 문장부호를 그대로 둔다)
  return /([.!?'"]|<\/d>)$/.test(c) ? c : `${c}.`;
};

/** 구간 정리: 0초 시작, 영상 길이 안으로 자르고 마지막 구간을 길이에 맞춘다 */
export function normalizeSegments(segments: Blocks["segments"], duration: number, pace: Pace = "normal") {
  const sorted = [...segments]
    .map((s) => ({ ...s, start: Math.round(s.start), end: Math.round(s.end) }))
    .filter((s) => s.action.trim() && s.start < duration)
    .sort((a, b) => a.start - b.start);
  if (!sorted.length) return [];
  sorted[0].start = 0;
  // 빠름: 첫 동작이 영상의 20% 안에 끝나도록 두 번째 구간 시작을 당긴다
  if (pace === "fast" && sorted.length > 1) {
    const limit = Math.max(1, Math.round(duration * 0.2));
    if (sorted[1].start > limit) sorted[1].start = limit;
    for (let i = 2; i < sorted.length; i++) {
      if (sorted[i].start <= sorted[i - 1].start) sorted[i].start = sorted[i - 1].start + 1;
    }
  }
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[i + 1];
    sorted[i].end = next ? next.start : duration;
    if (sorted[i].end <= sorted[i].start) sorted[i].end = sorted[i].start + 1;
  }
  return sorted;
}

/** 대사 언어 태그 (공식 문법 <d>[Language] ...</d>) */
export function dialogueLanguage(text: string) {
  if (/[가-힣ㄱ-ㆎ]/.test(text)) return "Korean";
  if (/[぀-ヿ]/.test(text)) return "Japanese";
  if (/[一-鿿]/.test(text)) return "Chinese";
  return "English";
}

/** 모델이 옛 표기(@image1)를 써도 공식 표기로 바꾼다 */
const fixRefs = (t: string) => t.replace(/@image\d+\b/gi, "<Picture 1>");
/** 모델이 쓰면 안 되는 <Picture 2> 이상 참조를 지운다 (도착 문장은 코드가 넣는다) */
const dropEndRefs = (t: string) =>
  t
    .replace(/(?:\s+(?:as shown in|shown in|as in|in|of|from))?\s*<Picture (?:[2-9]|\d{2,})>/gi, "")
    // 모델이 쓴 끝맺음("The shot ends on the final frame.", "... until the shot ends on the final frame")은 지운다 — 도착 문장은 코드가 한 번만 넣는다
    .replace(/,?\s*(?:until|before|as|when)\s+the (?:shot|clip|video) ends(?: on the (?:final|last) frame)?/gi, "")
    .replace(/(?:^|\s)The (?:shot|clip|video) ends(?: on the (?:final|last) frame)?[^.]*\.?/gi, " ")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

function styleFor(blocks: Blocks, ctx: AssembleContext) {
  const s = blocks.style.trim().replace(/[.,]\s*$/, "");
  if (s) return capitalize(s);
  if (ctx.imageType === "photo") return "Live-action";
  if (ctx.imageType === "cgi") return "3D CG";
  return "Illustrated in the same art style as <Picture 1>";
}

export function assemblePrompt(blocks: Blocks, ctx: AssembleContext) {
  const noun = ctx.personCentric && blocks.subject_noun !== "none" ? blocks.subject_noun : null;
  const who = noun ? `the ${noun} in <Picture 1>` : "";
  const Who = who ? capitalize(who) : "";
  // 모델이 지칭어("the man in <Picture 1>")까지 써도 코드가 넣는 지칭어와 겹치지 않게 앞부분을 지운다
  const subject = fixRefs(blocks.subject.trim())
    .replace(/[.]\s*$/, "")
    .replace(noun ? /^(?:the|a|an)\s+(?:woman|man|person|character|girl|boy|lady|guy)\s+(?:in|from)\s+<Picture 1>\s*/i : /^$/, "");

  // [Shot 1] 이미지 기준점: 스타일 → 피사체(복장·소품) → 구도 → 장소·조명 → (자세 유지·프레임 확장·카메라) → 동작
  const parts: string[] = [];
  parts.push(sentence(`${styleFor(blocks, ctx)}, ${[who, subject].filter(Boolean).join(" ")}`));
  parts.push(sentence(fixRefs(blocks.composition)));
  parts.push(sentence(fixRefs(blocks.location)));
  parts.push(sentence(fixRefs(blocks.lighting)));
  if (blocks.keep_original_pose && Who) parts.push(`${Who} stays in the same position and pose as in <Picture 1>.`);
  if (ctx.allowFrameExtension) parts.push(sentence(fixRefs(blocks.frame_extension)));
  parts.push(blocks.camera.trim() ? sentence(fixRefs(blocks.camera)) : "The camera stays static.");
  if (Who && ctx.gaze === "camera") parts.push(`${Who} looks directly into the camera.`);

  // 동작: 모델이 쓴 플레이스홀더는 지우고, 코드가 핵심 동작 구간에 정확히 한 번 넣는다
  // 모델이 카메라 문장을 동작 안에 또 쓰면 지운다 (카메라는 한 번만)
  const cam = blocks.camera.trim().replace(/[.]\s*$/, "");
  // 카메라는 카메라 문장 한 곳에서만: 동작 안의 "The camera …" 문장은 지운다 (고정 카메라와 모순되거나 같은 움직임이 두 번 나오지 않게)
  const dropCam = (t: string) =>
    (cam ? t.split(`${cam}.`).join("").split(cam).join("") : t)
      .replace(/(?:^|(?<=[.!?]\s))The camera\b[^.!?]*[.!?]?/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  let segments = blocks.segments.map((s) => ({ ...s, action: dropEndRefs(dropCam(fixRefs(s.action.split(ctx.placeholder).join("").trim()))) }));
  const pick = (n: number) => Math.min(Math.max(n, 0), segments.length - 1);
  if (ctx.keyMode === "placeholder") {
    const i = pick(blocks.key_action_segment);
    segments = segments.map((s, j) =>
      // 사람이 중심이 아니면 지칭어 없이 빈칸만 ("Then the subject { … }" 같은 어색한 문장 방지)
      j === i ? { ...s, action: `${sentence(s.action)} Then ${who ? `${who} ` : ""}${ctx.placeholder}`.trim() } : s,
    );
  }
  // 대사: 모델은 구간 번호만 정하고, 원문은 코드가 그대로 넣는다 (번역·수정 없음)
  const line = (ctx.dialogue ?? "").replace(/<\/?d>/gi, "").trim();
  if (line) {
    const i = pick(blocks.dialogue_segment < 0 ? segments.length - 1 : blocks.dialogue_segment);
    // 화면에 말할 인물이 없으면 화면 밖 내레이터의 보이스오버로 쓴다
    const speaker = Who || "A narrator";
    const voice = blocks.voice.trim().replace(/[.,]\s*$/, "").replace(/^(in|with)\s+/i, "");
    const d = `<d>[${dialogueLanguage(line)}] ${line}</d>`;
    const intro = `${speaker} (S1)${voice ? `, in ${voice},` : ""}`;
    const said =
      ctx.dialogueMode === "voiceover" || !Who
        ? `${intro} says in an off-screen voiceover: ${d}${noun ? ` while the ${noun}'s lips remain completely closed.` : ""}`
        : `${intro} says: ${d}`;
    segments = segments.map((s, j) => (j === i ? { ...s, action: `${sentence(s.action)} ${said}` } : s));
  }
  const norm = normalizeSegments(segments, ctx.duration, ctx.pace);
  if (ctx.segmentRender === "timed") {
    for (const s of norm) parts.push(`From ${s.start}s to ${s.end}s, ${lowerFirst(sentence(s.action))}`);
  } else {
    for (const s of norm) parts.push(sentence(s.action));
  }

  if (ctx.endFrame) parts.push(END_FRAME_SENTENCE);
  const description = `[Shot 1] ${parts.filter(Boolean).join(" ")}`;
  const soundscape = sentence(fixRefs(blocks.soundscape)) || "Natural ambient sound of the scene.";
  const music = NONE.test(blocks.background_music.trim()) ? "N/A" : sentence(blocks.background_music);

  return [
    ctx.endFrame ? fl2vaAlignment(ctx.duration) : I2VA_ALIGNMENT,
    "",
    `integrated_multimodal_description: ${description}`,
    "",
    `overall_soundscape: ${soundscape}`,
    "",
    `non_diegetic_music: ${music}`,
  ].join("\n");
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** "She walks" → "she walks" (고유명사·I는 그대로) */
const lowerFirst = (s: string) =>
  /^(She|He|They|The|A|An|It|His|Her|Their|Then|Next|Finally)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

export type OutputViolation =
  | "PLACEHOLDER_MISSING"
  | "PLACEHOLDER_UNEXPECTED"
  | "EXPLICIT_OUTPUT"
  | "ESCALATED"
  /** 중화한 요청인데 결과에 엉덩이·가슴·허벅지 등 신체 부위가 나옴 */
  | "BODY_FOCUS"
  | "TOO_LONG"
  /** 정렬 문장·3필드·[Shot 1] 구조가 깨짐 또는 동작 서술이 비어 있음 */
  | "EMPTY"
  /** 옛 형식 토큰(@image, [Core idea], Forbidden: 등)이 남음 */
  | "LEGACY_TOKEN"
  /** 사용자 대사가 없는데 대사 태그가 나옴 */
  | "DIALOGUE_UNEXPECTED"
  /** 그림 참조 오류: 없는 그림(<Picture 3> 등)을 가리킴, 시작·끝 모드인데 <Picture 2> 도착 문장이 없거나 여러 번 */
  | "PICTURE_REF";

/**
 * 출력 검사: 플레이스홀더가 정확히 한 번 남았는지,
 * 수위가 입력보다 올라가지 않았는지, 길이 제한.
 */
export function checkOutput(args: {
  profile: Profile;
  prompt: string;
  mode: KeyActionMode;
  inputWasSuggestive: boolean;
  /** 중화한 요청이면 신체 부위 단어도 막는다 */
  neutralized?: boolean;
  /** 사용자가 대사를 줬는지 (없는데 <d>·(S1)이 나오면 위반) */
  hasDialogue?: boolean;
  /** 시작·끝 이미지 모드면 영상 길이 (정렬 문장의 끝 초) */
  endFrame?: { duration: number };
}): OutputViolation[] {
  const { profile, prompt, mode, inputWasSuggestive, neutralized = false, hasDialogue = false, endFrame } = args;
  const v: OutputViolation[] = [];
  const ph = profile.placeholder;
  const count = prompt.split(ph).length - 1;

  const structured =
    prompt.startsWith(`${endFrame ? fl2vaAlignment(endFrame.duration) : I2VA_ALIGNMENT}\n\nintegrated_multimodal_description: [Shot 1] `) &&
    /\n\noverall_soundscape: \S[^\n]*\n\nnon_diegetic_music: \S/.test(prompt);
  if (!structured) v.push("EMPTY");
  if (/@image\d|\[(Reference|Core idea|Scene-by-scene)\]|^Forbidden:/im.test(prompt)) v.push("LEGACY_TOKEN");
  if (!hasDialogue && /<d>|\(S\d\)/.test(prompt)) v.push("DIALOGUE_UNEXPECTED");
  // 그림 참조: 한 장이면 <Picture 1>만, 두 장이면 <Picture 2>는 도착 문장의 한 번만 (정렬 문장의 꺾쇠 없는 표기는 세지 않는다)
  const refs = [...prompt.matchAll(/<Picture (\d+)>/g)].map((m) => Number(m[1]));
  const extra = refs.some((n) => n < 1 || n > (endFrame ? 2 : 1)) || /\bPicture (?:[3-9]|\d{2,})\b/.test(prompt) || (!endFrame && /\bPicture 2\b/.test(prompt));
  const endOnce = !endFrame || (prompt.split(END_FRAME_SENTENCE).length === 2 && refs.filter((n) => n === 2).length === 1);
  if (extra || !endOnce) v.push("PICTURE_REF");
  if (mode === "placeholder" && count !== 1) v.push("PLACEHOLDER_MISSING");
  if (mode !== "placeholder" && count > 0) v.push("PLACEHOLDER_UNEXPECTED");

  const text = prompt.split(ph).join(" ");
  if (matchList(text, EXPLICIT).length) v.push("EXPLICIT_OUTPUT");
  if (!inputWasSuggestive && matchList(text, SUGGESTIVE).length) v.push("ESCALATED");
  if (neutralized && matchList(text, BODY_FOCUS).length) v.push("BODY_FOCUS");
  if (prompt.length > profile.max_output_chars) v.push("TOO_LONG");
  return v;
}
