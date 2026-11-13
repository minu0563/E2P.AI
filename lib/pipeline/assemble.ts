/**
 * 조립 템플릿 (순수 함수, 테스트 대상).
 * 모델은 블록별 내용(JSON)만 쓰고, 고정 문장·구조·타이밍은 코드가 넣어 빠지지 않게 한다.
 */
import * as z from "zod";
import type { FieldKey, Pace, Profile } from "@/lib/profile";
import { EXPLICIT, SUGGESTIVE, matchList } from "@/system/safety/keywords";

export type Fields = Record<FieldKey, string>;
export type KeyActionMode = "user" | "placeholder" | "auto";

/** 생성 모델이 채우는 블록 */
export const BlocksSchema = z.object({
  subject: z.string(),
  location: z.string(),
  event: z.string(),
  style: z.string(),
  camera: z.string(),
  lighting: z.string(),
  keep_original_pose: z.boolean(),
  frame_extension: z.string(),
  segments: z
    .array(z.object({ start: z.number(), end: z.number(), action: z.string(), sound: z.string() }))
    .min(1)
    .max(6),
  /** 핵심 동작이 일어나는 구간 번호(0부터). 플레이스홀더 모드에서 코드가 이 구간에 빈칸을 넣는다 */
  key_action_segment: z.number().int(),
  audio: z.string(),
  background_music: z.string(),
  forbidden: z.string(),
});
export type Blocks = z.infer<typeof BlocksSchema>;
export const blocksJsonSchema = z.toJSONSchema(BlocksSchema);

export type AssembleContext = {
  duration: number;
  aspectRatio: string;
  personCentric: boolean;
  imageType: "photo" | "illustration" | "cgi";
  keyMode: KeyActionMode;
  placeholder: string;
  pace?: Pace;
  /** 사용자가 대사를 줬는지. 없으면 말하지 않게 명시 */
  hasDialogue?: boolean;
  /** 사용자가 화면 밖 신체(전신·다리·신발 등)나 카메라 확장을 요청했는지. 아니면 프레임 확장 문장을 버린다 */
  allowFrameExtension?: boolean;
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
  return /[.!?'"]$/.test(t) ? t : `${t}.`;
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

export function assemblePrompt(blocks: Blocks, ctx: AssembleContext) {
  const who = ctx.imageType === "photo" ? "the person from @image1" : "the character from @image1";
  const lines: string[] = [];

  // [Reference]
  lines.push(
    ctx.personCentric
      ? `[Reference] @image1 is the character reference and the first frame (lock this ${
          ctx.imageType === "photo" ? "person" : "character"
        }'s face exactly; no face change).`
      : "[Reference] @image1 is the scene reference and the first frame.",
  );

  // [Core idea]
  const head = `${ctx.duration}s${ctx.aspectRatio ? `, ${ctx.aspectRatio}` : ""}. One continuous take, no cuts.`;
  const style =
    blocks.style.trim() ||
    (ctx.imageType === "photo"
      ? "Realistic live-action footage, no cinematic look"
      : "Keep the original art style of @image1, no cinematic look");
  const core = [
    head,
    sentence(`Subject: ${blocks.subject}`),
    sentence(`Location: ${blocks.location}`),
    sentence(`Event: ${blocks.event}`),
    sentence(`Style: ${style}`),
    blocks.lighting.trim() ? sentence(`Lighting: ${blocks.lighting}`) : "",
    blocks.camera.trim() ? sentence(`Camera: ${blocks.camera}`) : "Keep the original image composition.",
    blocks.keep_original_pose && ctx.personCentric
      ? `Keep ${who}'s position, pose and face exactly 100% identical to the original image.`
      : "",
    ctx.allowFrameExtension ? sentence(blocks.frame_extension) : "",
    ctx.personCentric
      ? `${capitalize(who)} looks directly into the camera at all times and stays in frame at all times.`
      : "",
  ].filter(Boolean);
  lines.push(`[Core idea] ${core.join(" ")}`);

  // [Scene-by-scene]
  lines.push("[Scene-by-scene]");
  // 빈칸 모드: 모델이 쓴 플레이스홀더는 지우고, 코드가 핵심 동작 구간에 정확히 한 번 넣는다
  let segments = blocks.segments.map((s) => ({ ...s, action: s.action.split(ctx.placeholder).join("").trim() }));
  if (ctx.keyMode === "placeholder") {
    const i = Math.min(Math.max(blocks.key_action_segment, 0), segments.length - 1);
    segments = segments.map((s, j) =>
      j === i
        ? {
            ...s,
            action: `${sentence(s.action)} Key action: ${ctx.personCentric ? `${who} ` : ""}${ctx.placeholder}`.trim(),
          }
        : s,
    );
  }
  for (const s of normalizeSegments(segments, ctx.duration, ctx.pace)) {
    const sound = s.sound.trim() ? ` ${sentence(`Sound: ${s.sound}`)}` : "";
    lines.push(`${s.start}–${s.end}s: ${sentence(s.action)}${sound}`);
  }

  const music = NONE.test(blocks.background_music.trim())
    ? "non_diegetic_music: N/A"
    : sentence(`Background music: ${blocks.background_music}`);
  const speech = ctx.hasDialogue === false && ctx.personCentric ? "No dialogue, no speaking." : "";
  lines.push(`Audio: ${[sentence(blocks.audio), speech, music].filter(Boolean).join(" ")}`);
  if (blocks.forbidden.trim()) lines.push(sentence(`Forbidden: ${blocks.forbidden}`));

  return lines.join("\n");
}

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

export type OutputViolation =
  | "PLACEHOLDER_MISSING"
  | "PLACEHOLDER_UNEXPECTED"
  | "EXPLICIT_OUTPUT"
  | "ESCALATED"
  | "TOO_LONG"
  | "EMPTY";

/**
 * 출력 검사: 플레이스홀더가 정확히 한 번 남았는지,
 * 수위가 입력보다 올라가지 않았는지, 길이 제한.
 */
export function checkOutput(args: {
  profile: Profile;
  prompt: string;
  mode: KeyActionMode;
  inputWasSuggestive: boolean;
}): OutputViolation[] {
  const { profile, prompt, mode, inputWasSuggestive } = args;
  const v: OutputViolation[] = [];
  const ph = profile.placeholder;
  const count = prompt.split(ph).length - 1;

  if (!/\[Scene-by-scene\]\n\d/.test(prompt)) v.push("EMPTY");
  if (mode === "placeholder" && count !== 1) v.push("PLACEHOLDER_MISSING");
  if (mode !== "placeholder" && count > 0) v.push("PLACEHOLDER_UNEXPECTED");

  const text = prompt.split(ph).join(" ");
  if (matchList(text, EXPLICIT).length) v.push("EXPLICIT_OUTPUT");
  if (!inputWasSuggestive && matchList(text, SUGGESTIVE).length) v.push("ESCALATED");
  if (prompt.length > profile.max_output_chars) v.push("TOO_LONG");
  return v;
}
