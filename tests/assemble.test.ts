import { describe, expect, it } from "vitest";
import {
  assemblePrompt,
  checkOutput,
  normalizeSegments,
  type AssembleContext,
  type Blocks,
} from "@/lib/pipeline/assemble";
import { DEFAULT_PROFILE, PROFILES } from "@/lib/profile";

const profile = PROFILES[DEFAULT_PROFILE];
const blocks: Blocks = {
  subject: "the person from @image1 in a white linen shirt",
  location: "a sandy beach at sunset",
  event: "she walks along the shoreline and waves",
  style: "",
  camera: "",
  lighting: "warm natural sunset light",
  keep_original_pose: false,
  frame_extension: "",
  segments: [
    { start: 0, end: 3, action: "She breathes in and starts walking", sound: "waves" },
    { start: 3, end: 8, action: "She raises her right hand and waves", sound: "" },
  ],
  key_action_segment: 1,
  audio: "soft waves and wind",
  background_music: "",
  forbidden: "watermark, subtitles",
};
const photo: AssembleContext = {
  duration: 8,
  aspectRatio: "9:16",
  personCentric: true,
  imageType: "photo",
  keyMode: "auto",
  placeholder: profile.placeholder,
};

describe("assemblePrompt", () => {
  it("3단 구조와 고정 문장을 코드가 넣는다", () => {
    const p = assemblePrompt(blocks, photo);
    expect(p).toMatch(/^\[Reference\] @image1 is the character reference/);
    expect(p).toContain("[Core idea] 8s, 9:16.");
    expect(p).toContain("Realistic live-action footage, no cinematic look");
    expect(p).toContain("Keep the original image composition.");
    expect(p).toContain("looks directly into the camera at all times and stays in frame at all times");
    expect(p).toContain("[Scene-by-scene]\n0–3s:");
    expect(p).toContain("3–8s:");
    expect(p).toContain("non_diegetic_music: N/A");
  });

  it("카메라를 지정하면 원본 구도 유지 문장 대신 카메라", () => {
    const p = assemblePrompt({ ...blocks, camera: "slow push-in" }, photo);
    expect(p).toContain("Camera: slow push-in.");
    expect(p).not.toContain("Keep the original image composition");
  });

  it("일러스트는 원본 화풍 유지, 인물 없는 이미지는 인물 규칙 없음", () => {
    expect(assemblePrompt(blocks, { ...photo, imageType: "illustration" })).toContain("original art style");
    const p = assemblePrompt(blocks, { ...photo, personCentric: false });
    expect(p).toContain("scene reference");
    expect(p).not.toContain("looks directly into the camera");
  });

  it("배경 음악을 원하면 N/A 대신 음악", () => {
    const p = assemblePrompt({ ...blocks, background_music: "soft piano" }, photo);
    expect(p).toContain("Background music: soft piano.");
    expect(p).not.toContain("N/A");
  });

  it("원본 유지 문장", () => {
    expect(assemblePrompt({ ...blocks, keep_original_pose: true }, photo)).toContain("100% identical");
  });
});

describe("normalizeSegments", () => {
  it("0초 시작, 마지막 구간을 길이에 맞춤", () => {
    const s = normalizeSegments(
      [
        { start: 1, end: 4, action: "a", sound: "" },
        { start: 4, end: 6, action: "b", sound: "" },
        { start: 12, end: 14, action: "too late", sound: "" },
      ],
      10,
    );
    expect(s.map((x) => [x.start, x.end])).toEqual([
      [0, 4],
      [4, 10],
    ]);
  });

  it("빠름: 첫 동작은 앞 20% 안에 끝난다", () => {
    const s = normalizeSegments(
      [
        { start: 0, end: 5, action: "a", sound: "" },
        { start: 5, end: 8, action: "b", sound: "" },
        { start: 8, end: 10, action: "c", sound: "" },
      ],
      10,
      "fast",
    );
    expect(s.map((x) => [x.start, x.end])).toEqual([
      [0, 2],
      [2, 8],
      [8, 10],
    ]);
  });
});

describe("checkOutput", () => {
  const ph = profile.placeholder;
  const check = (b: Blocks, mode: "user" | "placeholder" | "auto", inputWasSuggestive = false) =>
    checkOutput({ profile, prompt: assemblePrompt(b, { ...photo, keyMode: mode }), mode, inputWasSuggestive });

  it("정상 출력은 위반 없음", () => {
    expect(check(blocks, "auto")).toEqual([]);
  });

  it("빈칸 모드: 코드가 핵심 동작 구간에 정확히 한 번 넣는다", () => {
    const p = assemblePrompt(blocks, { ...photo, keyMode: "placeholder" });
    expect(p.split(ph).length - 1).toBe(1);
    expect(p).toMatch(new RegExp(`3–8s: .*Key action: the person from @image1 \\{ 유저가`));
    expect(check(blocks, "placeholder")).toEqual([]);
  });

  it("모델이 빈칸 문자열을 써도 지워지고, 범위 밖 구간 번호는 보정", () => {
    const withPh = {
      ...blocks,
      key_action_segment: 9,
      segments: [{ ...blocks.segments[0], action: `walks ${ph}` }, blocks.segments[1]],
    };
    expect(check(withPh, "placeholder")).toEqual([]);
    expect(check(withPh, "auto")).toEqual([]);
  });

  it("배경 음악 None은 N/A로", () => {
    expect(assemblePrompt({ ...blocks, background_music: "None." }, photo)).toContain("non_diegetic_music: N/A");
  });

  it("수위 상승·노골적 출력 감지", () => {
    expect(check({ ...blocks, style: "sexy, seductive" }, "auto")).toContain("ESCALATED");
    expect(check({ ...blocks, style: "sexy" }, "auto", true)).not.toContain("ESCALATED");
    expect(check({ ...blocks, event: "she gets naked" }, "auto")).toContain("EXPLICIT_OUTPUT");
  });
});

describe("프레임 확장(전신 보이기)은 사용자가 요청했을 때만", async () => {
  const { wantsFrameExtension } = await import("@/lib/pipeline/assemble");
  it("전신·다리·걷기·줌아웃 같은 요청이면 허용", () => {
    for (const t of ["전신이 보이게", "해변을 걷는다", "카메라가 점점 멀어진다", "full body shot", "she walks away", "zooms out"]) {
      expect(wantsFrameExtension([t])).toBe(true);
    }
  });
  it("상반신 동작만 있으면 원본 구도 유지", () => {
    for (const t of ["손을 흔든다", "뒤돌아보며 웃는다", "waves both hands", "Looks back and smiles", ""]) {
      expect(wantsFrameExtension([t])).toBe(false);
    }
  });
});
