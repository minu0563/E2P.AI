/**
 * 출력 품질 검사 (순수 함수, 테스트 대상).
 * 안전 검사(checkOutput)와 달리 결과를 막거나 다시 만들지 않는다 — 지금은 기록만 해서 빈도를 본다.
 * 검사 대상은 모델이 쓴 블록 텍스트뿐 (코드가 넣는 정렬 문장·시선 문장·<d> 대사 블록은 제외).
 * 대사 길이(DIALOGUE_TOO_LONG)만 사용자에게 안내를 띄운다 (안내 코드 dialogue_long).
 */
import { normalizeSegments, type AssembleContext, type Blocks } from "./assemble";
import {
  FACE_REQUEST,
  FACE_WORDS,
  FEET_WORDS,
  LEG_WORDS,
  MUSIC_DENY,
  MUSIC_MOOD,
  MUSIC_REQUEST,
  SOUND_FORBIDDEN,
  STYLE_REQUEST,
  STYLE_WORDS,
} from "@/system/quality/words";

export type QualityWarning =
  /** 요청하지 않은 얼굴·표정·시선 묘사 */
  | "FACE_LEAK"
  /** 실사 사진인데 영화풍 스타일 단어 (cinematic, bokeh…) */
  | "STYLE_LEAK"
  /** 사진에 안 보이는 다리·발을 움직이는 묘사 */
  | "OFF_FRAME_BODY"
  /** 소리 설명이 비었거나 5문장 이상, 또는 음악·대사가 섞임 */
  | "SOUNDSCAPE_RULE"
  /** 요청하지 않은 배경 음악, 4문장 이상, 분위기 단어 */
  | "MUSIC_RULE"
  /** 대사가 들어갈 구간에 비해 너무 김 (사용자 안내) */
  | "DIALOGUE_TOO_LONG";

const NONE = /^(none|n\/?a|no( background)? music|없음|-)?\.?$/i;
const sentences = (s: string) => s.split(/[.!?]+/).filter((x) => x.trim()).length;

/** 초당 말할 수 있는 양을 넘는지 (한국어 약 5음절, 영어 약 3단어, 일본어·중국어 약 6자) */
export function dialogueTooLong(line: string, seconds: number) {
  const t = line.trim();
  if (!t || seconds <= 0) return false;
  const hangul = (t.match(/[가-힣]/g) ?? []).length;
  if (hangul) return hangul > seconds * 5;
  const cjk = (t.match(/[぀-ヿ一-鿿]/g) ?? []).length;
  if (cjk) return cjk > seconds * 6;
  return t.split(/\s+/).length > seconds * 3;
}

export function checkQuality(
  blocks: Blocks,
  ctx: Pick<AssembleContext, "imageType" | "personCentric" | "allowFrameExtension" | "dialogue" | "duration" | "pace" | "gaze">,
  args: {
    /** 사용자가 쓴 모든 텍스트 (요청·항목) */
    userTexts: string[];
    /** 이미지 분석의 안 보이는 신체 부위 (legs, feet …) */
    notVisibleBodyParts: string[];
    /** 이미지 분석이 본 장면·조명 (사진 속 실제 네온사인 같은 건 스타일 누출이 아님) */
    imageFacts: string[];
  },
): QualityWarning[] {
  const w: QualityWarning[] = [];
  const user = args.userTexts.filter(Boolean).join("\n");
  const actions = blocks.segments.map((s) => s.action).join(" ");
  const written = [blocks.subject, blocks.composition, blocks.location, blocks.lighting, blocks.style, blocks.camera, actions]
    .concat(ctx.allowFrameExtension ? [blocks.frame_extension] : [])
    .join(" ");

  // 얼굴·표정: 시선을 카메라로 고정했으면 그 문장은 빼고 본다
  const faceText = ctx.gaze === "camera" ? written.replace(/looks? (directly )?(into|at) the (camera|lens)/gi, "") : written;
  if (!FACE_REQUEST.test(user) && FACE_WORDS.test(faceText)) w.push("FACE_LEAK");

  // 스타일: 실사 사진 + 사용자가 스타일을 말하지 않았는데 영화풍 단어. 이미지에 실제로 있는 것(네온사인 등)은 제외
  if (ctx.imageType === "photo" && !STYLE_REQUEST.test(user)) {
    const facts = args.imageFacts.join(" ").toLowerCase();
    const hits = [...written.matchAll(new RegExp(STYLE_WORDS.source, "gi"))].map((m) => m[0].toLowerCase());
    if (hits.some((h) => !facts.includes(h))) w.push("STYLE_LEAK");
  }

  // 화면 밖 신체: 사용자가 전신·걷기 등을 요청하지 않았는데 안 보이는 다리·발을 움직임
  if (ctx.personCentric && !ctx.allowFrameExtension) {
    const hidden = args.notVisibleBodyParts.map((p) => p.toLowerCase());
    const body = `${blocks.subject} ${actions}`;
    if ((hidden.includes("legs") && LEG_WORDS.test(body)) || (hidden.includes("feet") && FEET_WORDS.test(body))) {
      w.push("OFF_FRAME_BODY");
    }
  }

  // 소리: 1~4문장, 음악·대사 없음
  const sc = blocks.soundscape.trim();
  if (!sc || sentences(sc) >= 5 || SOUND_FORBIDDEN.test(sc)) w.push("SOUNDSCAPE_RULE");

  // 배경 음악: 요청했을 때만, 3문장 이하, 분위기 단어 없이
  const music = blocks.background_music.trim();
  if (!NONE.test(music)) {
    const wanted = MUSIC_REQUEST.test(user) && !MUSIC_DENY.test(user);
    if (!wanted || sentences(music) >= 4 || MUSIC_MOOD.test(music)) w.push("MUSIC_RULE");
  }

  // 대사 길이: 대사가 시작되는 구간부터 영상 끝까지 말할 수 있는 양 기준
  const line = (ctx.dialogue ?? "").trim();
  if (line) {
    const norm = normalizeSegments(blocks.segments, ctx.duration, ctx.pace);
    if (norm.length) {
      const i = Math.min(Math.max(blocks.dialogue_segment < 0 ? norm.length - 1 : blocks.dialogue_segment, 0), norm.length - 1);
      if (dialogueTooLong(line, ctx.duration - norm[i].start)) w.push("DIALOGUE_TOO_LONG");
    }
  }
  return w;
}
