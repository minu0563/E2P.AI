import { describe, expect, it } from "vitest";
import type { Blocks } from "@/lib/pipeline/assemble";
import { checkQuality, dialogueTooLong } from "@/lib/pipeline/quality";
import { nearestRatio } from "@/lib/aspect";

const blocks: Blocks = {
  subject_noun: "woman",
  subject: "wears a white linen shirt",
  composition: "A waist-up shot frames her in the center",
  location: "A sandy beach at sunset",
  lighting: "Warm natural sunset light",
  style: "",
  camera: "",
  keep_original_pose: false,
  frame_extension: "",
  event: "she turns and waves",
  segments: [
    { start: 0, end: 3, action: "She breathes in and starts to turn toward the sea" },
    { start: 3, end: 8, action: "Then she raises her right hand and waves" },
  ],
  key_action_segment: 1,
  dialogue_segment: -1,
  voice: "",
  soundscape: "Soft waves and light wind",
  background_music: "",
};
const ctx: Parameters<typeof checkQuality>[1] = {
  imageType: "photo",
  personCentric: true,
  allowFrameExtension: false,
  dialogue: "",
  duration: 8,
  pace: "normal",
  gaze: "auto",
};
const args = { userTexts: ["손을 흔든다"], notVisibleBodyParts: ["legs", "feet"], imageFacts: ["sandy beach", "sunset light"] };
const run = (b: Partial<Blocks> = {}, c: Partial<typeof ctx> = {}, a: Partial<typeof args> = {}) =>
  checkQuality({ ...blocks, ...b }, { ...ctx, ...c }, { ...args, ...a });
const seg = (action: string) => [{ start: 0, end: 8, action }];

describe("출력 품질 검사 (기록만)", () => {
  it("문제없는 결과는 경고 없음", () => {
    expect(run()).toEqual([]);
  });

  it("FACE_LEAK: 요청하지 않은 표정 묘사", () => {
    expect(run({ segments: seg("She smiles warmly and waves") })).toContain("FACE_LEAK");
    // 사용자가 웃으라고 했으면 정상
    expect(run({ segments: seg("She smiles warmly and waves") }, {}, { userTexts: ["웃으며 손을 흔든다"] })).not.toContain("FACE_LEAK");
    // 시선을 카메라로 고정한 옵션이면 카메라 응시 문장은 괜찮음
    expect(run({ segments: seg("She looks into the camera and waves") }, { gaze: "camera" })).not.toContain("FACE_LEAK");
    expect(run({ segments: seg("She looks into the camera and waves") })).toContain("FACE_LEAK");
  });

  it("STYLE_LEAK: 실사 사진에 영화풍 단어", () => {
    expect(run({ lighting: "Cinematic golden light with bokeh" })).toContain("STYLE_LEAK");
    expect(run({ lighting: "Cinematic golden light" }, { imageType: "illustration" })).not.toContain("STYLE_LEAK");
    expect(run({ lighting: "Cinematic golden light" }, {}, { userTexts: ["영화처럼 찍어 줘"] })).not.toContain("STYLE_LEAK");
    // 사진에 실제 네온사인이 있으면 누출이 아님
    expect(run({ location: "A street with neon signs" }, {}, { imageFacts: ["a night street with neon signs"] })).not.toContain("STYLE_LEAK");
  });

  it("OFF_FRAME_BODY: 안 보이는 다리·발을 움직임", () => {
    expect(run({ segments: seg("She walks toward the sea") })).toContain("OFF_FRAME_BODY");
    expect(run({ subject: "wears blue jeans" })).toContain("OFF_FRAME_BODY");
    // 걷기를 요청했으면(프레임 확장) 정상
    expect(run({ segments: seg("She walks toward the sea") }, { allowFrameExtension: true })).not.toContain("OFF_FRAME_BODY");
    // 발이 보이는 사진이면 정상
    expect(run({ segments: seg("She walks toward the sea") }, {}, { notVisibleBodyParts: [] })).not.toContain("OFF_FRAME_BODY");
  });

  it("SOUNDSCAPE_RULE: 비었거나 너무 길거나 음악·대사가 섞임", () => {
    expect(run({ soundscape: "" })).toContain("SOUNDSCAPE_RULE");
    expect(run({ soundscape: "Waves. Wind. Gulls. Steps. Breath." })).toContain("SOUNDSCAPE_RULE");
    expect(run({ soundscape: "Soft waves and gentle piano music" })).toContain("SOUNDSCAPE_RULE");
    expect(run({ soundscape: "Waves. Wind. Gulls. Breath." })).not.toContain("SOUNDSCAPE_RULE");
  });

  it("MUSIC_RULE: 요청 안 한 배경 음악, 분위기 단어", () => {
    expect(run({ background_music: "Soft acoustic guitar at a slow tempo" })).toContain("MUSIC_RULE");
    expect(run({ background_music: "Soft acoustic guitar at a slow tempo" }, {}, { userTexts: ["잔잔한 기타 음악"] })).not.toContain("MUSIC_RULE");
    expect(run({ background_music: "An emotional, uplifting piano melody" }, {}, { userTexts: ["피아노 음악 넣어줘"] })).toContain("MUSIC_RULE");
    expect(run({ background_music: "Soft guitar" }, {}, { userTexts: ["배경 음악 없음"] })).toContain("MUSIC_RULE");
    expect(run({ background_music: "N/A" })).not.toContain("MUSIC_RULE");
  });

  it("DIALOGUE_TOO_LONG: 대사가 시작 구간부터 끝까지 말하기에 너무 김", () => {
    // 마지막 구간(3~8초, 5초) → 한국어 25음절까지
    expect(run({}, { dialogue: "안녕하세요 반가워요" })).not.toContain("DIALOGUE_TOO_LONG");
    expect(run({}, { dialogue: "오늘은 정말 날씨가 좋아서 바닷가에 나와 보았는데 바람도 시원하고 파도 소리도 들려서 너무 좋네요" })).toContain(
      "DIALOGUE_TOO_LONG",
    );
    // 첫 구간에서 시작하면 8초 → 40음절까지
    expect(run({ dialogue_segment: 0 }, { dialogue: "오늘은 정말 날씨가 좋아서 바닷가에 나와 보았어요" })).not.toContain("DIALOGUE_TOO_LONG");
  });
});

describe("대사 길이 기준", () => {
  it("한국어 초당 5음절, 영어 초당 3단어", () => {
    expect(dialogueTooLong("가나다라마바", 1)).toBe(true);
    expect(dialogueTooLong("가나다라마", 1)).toBe(false);
    expect(dialogueTooLong("one two three four", 1)).toBe(true);
    expect(dialogueTooLong("one two three", 1)).toBe(false);
  });
});

describe("사진 비율 → 가장 가까운 화면 비율", () => {
  const ratios = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
  it("고른다", () => {
    expect(nearestRatio(756, 1344, ratios)).toBe("9:16");
    expect(nearestRatio(1920, 1080, ratios)).toBe("16:9");
    expect(nearestRatio(1000, 1000, ratios)).toBe("1:1");
    expect(nearestRatio(1200, 900, ratios)).toBe("4:3");
    expect(nearestRatio(2560, 1080, ratios)).toBe("21:9");
    expect(nearestRatio(3000, 4000, ratios)).toBe("3:4");
    expect(nearestRatio(0, 100, ratios)).toBe("");
  });
});
