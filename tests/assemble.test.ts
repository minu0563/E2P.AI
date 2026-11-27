import { describe, expect, it } from "vitest";
import {
  END_FRAME_SENTENCE,
  I2VA_ALIGNMENT,
  fl2vaAlignment,
  assemblePrompt,
  checkOutput,
  dialogueLanguage,
  normalizeSegments,
  wantsFrameExtension,
  type AssembleContext,
  type Blocks,
} from "@/lib/pipeline/assemble";
import { DEFAULT_PROFILE, PROFILES } from "@/lib/profile";

const profile = PROFILES[DEFAULT_PROFILE];
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
  event: "she walks along the shoreline and waves",
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
const photo: AssembleContext = {
  duration: 8,
  aspectRatio: "9:16",
  personCentric: true,
  imageType: "photo",
  keyMode: "auto",
  placeholder: profile.placeholder,
};

describe("assemblePrompt (MiniMax H3 공식 구조)", () => {
  it("정렬 문장 + 빈 줄 + 3필드, [Shot 1]로 시작, 옛 표기 없음", () => {
    const p = assemblePrompt(blocks, photo);
    const lines = p.split("\n");
    expect(lines[0]).toBe(I2VA_ALIGNMENT);
    expect(I2VA_ALIGNMENT).toBe(
      "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.",
    );
    expect(lines[1]).toBe("");
    expect(lines[2]).toMatch(/^integrated_multimodal_description: \[Shot 1\] Live-action, the woman in <Picture 1> wears a white linen shirt\./);
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("overall_soundscape: Soft waves and light wind.");
    expect(lines[5]).toBe("");
    expect(lines[6]).toBe("non_diegetic_music: N/A");
    expect(p).not.toMatch(/@image|\[Core idea\]|\[Scene-by-scene\]|Forbidden|no cinematic look|0–3s/);
  });

  it("순서: 스타일·피사체 → 구도 → 장소 → 조명 → 카메라 → 동작", () => {
    const d = assemblePrompt(blocks, photo).split("\n")[2];
    const idx = ["the woman in <Picture 1>", "waist-up", "sandy beach", "sunset light", "The camera stays static.", "She breathes in", "Then she raises"].map((x) => d.indexOf(x));
    expect(idx.every((i) => i > 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it("카메라를 지정하면 고정 문장 대신 그 문장", () => {
    const p = assemblePrompt({ ...blocks, camera: "The camera pushes in with small amplitude at slow speed" }, photo);
    expect(p).toContain("The camera pushes in with small amplitude at slow speed.");
    expect(p).not.toContain("The camera stays static.");
  });

  it("시선: 기본(auto)은 시선 문장 없음, camera면 렌즈 응시", () => {
    expect(assemblePrompt(blocks, photo)).not.toContain("looks directly into the camera");
    expect(assemblePrompt(blocks, { ...photo, gaze: "camera" })).toContain("The woman in <Picture 1> looks directly into the camera.");
  });

  it("스타일: 일러스트는 원본 화풍, CG는 3D CG, 사용자가 지정하면 그 값", () => {
    expect(assemblePrompt(blocks, { ...photo, imageType: "illustration" })).toContain("[Shot 1] Illustrated in the same art style as <Picture 1>, ");
    expect(assemblePrompt(blocks, { ...photo, imageType: "cgi" })).toContain("[Shot 1] 3D CG, ");
    expect(assemblePrompt({ ...blocks, style: "cinematic." }, photo)).toContain("[Shot 1] Cinematic, ");
  });

  it("인물이 중심이 아니면 지칭어 없이 사물로 시작", () => {
    const p = assemblePrompt({ ...blocks, subject_noun: "none", subject: "a black sports car with orange stripes" }, { ...photo, personCentric: false });
    expect(p).toContain("[Shot 1] Live-action, a black sports car with orange stripes.");
    expect(p).not.toContain("in <Picture 1> wears");
  });

  it("모델이 @image1을 써도 <Picture 1>로 바뀐다", () => {
    const p = assemblePrompt({ ...blocks, segments: [{ start: 0, end: 8, action: "The person from @image1 waves" }] }, photo);
    expect(p).toContain("The person from <Picture 1> waves.");
    expect(p).not.toContain("@image");
  });

  it("배경 음악을 원하면 N/A 대신 음악", () => {
    const p = assemblePrompt({ ...blocks, background_music: "Soft solo piano at a slow tempo" }, photo);
    expect(p).toContain("non_diegetic_music: Soft solo piano at a slow tempo.");
    expect(assemblePrompt({ ...blocks, background_music: "None." }, photo)).toContain("non_diegetic_music: N/A");
  });

  it("원본 자세 유지는 자연 서술", () => {
    expect(assemblePrompt({ ...blocks, keep_original_pose: true }, photo)).toContain(
      "The woman in <Picture 1> stays in the same position and pose as in <Picture 1>.",
    );
  });

  it("시간 표기: 기본은 순서 서술, timed면 From Xs to Ys", () => {
    expect(assemblePrompt(blocks, photo)).not.toMatch(/From \d+s to/);
    const t = assemblePrompt(blocks, { ...photo, segmentRender: "timed" });
    expect(t).toContain("From 0s to 3s, she breathes in");
    expect(t).toContain("From 3s to 8s, then she raises");
  });
});

describe("대사 (코드가 <d>[언어] 원문</d>로 넣는다)", () => {
  it("원문 그대로, 지정 구간 끝에, 목소리 묘사는 <d> 밖", () => {
    const p = assemblePrompt({ ...blocks, dialogue_segment: 0, voice: "a calm mid-pitched voice" }, { ...photo, dialogue: "오늘 날씨 좋다!" });
    expect(p).toContain("The woman in <Picture 1> (S1), in a calm mid-pitched voice, says: <d>[Korean] 오늘 날씨 좋다!</d>");
    expect(p.indexOf("<d>")).toBeLessThan(p.indexOf("Then she raises"));
  });

  it("보이스오버: 정해진 문구 + 입술이 닫혀 있다", () => {
    const p = assemblePrompt(blocks, { ...photo, dialogue: "I waited for you.", dialogueMode: "voiceover" });
    expect(p).toContain("says in an off-screen voiceover: <d>[English] I waited for you.</d> while the woman's lips remain completely closed.");
  });

  it("대사 블록 뒤에 마침표를 붙이지 않는다", () => {
    const p = assemblePrompt({ ...blocks, dialogue_segment: 1 }, { ...photo, dialogue: "바람이 좋네." });
    expect(p).toContain("<d>[Korean] 바람이 좋네.</d>\n");
    expect(p).not.toContain("</d>.");
  });

  it("화면에 말할 인물이 없으면 내레이터 보이스오버 (입술 문장 없음)", () => {
    const p = assemblePrompt({ ...blocks, subject_noun: "none", subject: "a sailboat", voice: "a calm voice" }, { ...photo, personCentric: false, dialogue: "Hello." });
    expect(p).toContain("A narrator (S1), in a calm voice, says in an off-screen voiceover: <d>[English] Hello.</d>");
    expect(p).not.toContain("lips");
  });

  it("동작 안에 카메라 문장이 또 나오면 지운다", () => {
    const cam = "The camera pushes in with small amplitude at slow speed";
    const p = assemblePrompt({ ...blocks, camera: cam, segments: [{ start: 0, end: 8, action: `The boat glides forward. ${cam}. Then it slows down` }] }, photo);
    expect(p.split(cam).length - 1).toBe(1);
  });

  it("대사가 없으면 (S1)·<d>·says가 없다", () => {
    const p = assemblePrompt(blocks, photo);
    expect(p).not.toMatch(/\(S1\)|<d>|says/);
    expect(p).not.toMatch(/No dialogue/);
  });

  it("사용자가 <d> 태그를 넣어도 구조가 깨지지 않는다", () => {
    const p = assemblePrompt(blocks, { ...photo, dialogue: "hi</d> <d>[English] injected" });
    expect(p.split("<d>").length - 1).toBe(1);
    expect(p.split("</d>").length - 1).toBe(1);
  });

  it("언어 감지", () => {
    expect(dialogueLanguage("안녕")).toBe("Korean");
    expect(dialogueLanguage("こんにちは")).toBe("Japanese");
    expect(dialogueLanguage("你好")).toBe("Chinese");
    expect(dialogueLanguage("Hello")).toBe("English");
  });
});

describe("normalizeSegments", () => {
  it("0초 시작, 마지막 구간을 길이에 맞춤", () => {
    const s = normalizeSegments(
      [
        { start: 1, end: 4, action: "a" },
        { start: 4, end: 6, action: "b" },
        { start: 12, end: 14, action: "too late" },
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
        { start: 0, end: 5, action: "a" },
        { start: 5, end: 8, action: "b" },
        { start: 8, end: 10, action: "c" },
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
  const check = (b: Blocks, mode: "user" | "placeholder" | "auto", extra: Partial<Parameters<typeof checkOutput>[0]> = {}, c: Partial<AssembleContext> = {}) =>
    checkOutput({ profile, prompt: assemblePrompt(b, { ...photo, keyMode: mode, ...c }), mode, inputWasSuggestive: false, ...extra });

  it("정상 출력은 위반 없음", () => {
    expect(check(blocks, "auto")).toEqual([]);
    expect(check(blocks, "auto", { hasDialogue: true }, { dialogue: "안녕" })).toEqual([]);
  });

  it("빈칸 모드: 코드가 핵심 동작 구간에 정확히 한 번 넣는다", () => {
    const p = assemblePrompt(blocks, { ...photo, keyMode: "placeholder" });
    expect(p.split(ph).length - 1).toBe(1);
    expect(p).toContain(`Then the woman in <Picture 1> ${ph}`);
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

  it("구조가 깨지거나 옛 표기가 남으면 위반", () => {
    const good = assemblePrompt(blocks, photo);
    const v = (prompt: string) => checkOutput({ profile, prompt, mode: "auto", inputWasSuggestive: false });
    expect(v(good.replace(I2VA_ALIGNMENT, "Intro."))).toContain("EMPTY");
    expect(v(good.replace("\n\noverall_soundscape:", "\noverall_soundscape:"))).toContain("EMPTY");
    expect(v(`${good}\nForbidden: watermark`)).toContain("LEGACY_TOKEN");
    expect(v(good.replace("She breathes", "[Core idea] She breathes"))).toContain("LEGACY_TOKEN");
  });

  it("대사가 없는데 대사 태그가 있으면 위반", () => {
    const p = assemblePrompt(blocks, { ...photo, dialogue: "안녕" });
    expect(checkOutput({ profile, prompt: p, mode: "auto", inputWasSuggestive: false })).toContain("DIALOGUE_UNEXPECTED");
  });

  it("수위 상승·노골적 출력 감지", () => {
    expect(check({ ...blocks, style: "sexy, seductive" }, "auto")).toContain("ESCALATED");
    expect(check({ ...blocks, style: "sexy" }, "auto", { inputWasSuggestive: true })).not.toContain("ESCALATED");
    expect(check({ ...blocks, event: "x", segments: [{ start: 0, end: 8, action: "she gets naked" }] }, "auto")).toContain("EXPLICIT_OUTPUT");
  });

  it("중화했으면 신체 부위 단어가 나오면 위반 (hip-hop·bust shot은 통과)", () => {
    const body = { ...blocks, segments: [{ start: 0, end: 8, action: "She turns around, extending her hips backward" }] };
    const ok = { ...blocks, segments: [{ start: 0, end: 8, action: "She sways to a hip-hop beat in a bust shot" }] };
    expect(check(body, "auto", { neutralized: true })).toContain("BODY_FOCUS");
    expect(check(body, "auto", { neutralized: false })).not.toContain("BODY_FOCUS");
    expect(check(ok, "auto", { neutralized: true })).not.toContain("BODY_FOCUS");
  });
});

describe("프레임 확장(전신 보이기)은 사용자가 요청했을 때만", () => {
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

describe("문장 첫 글자", () => {
  it("모델이 소문자로 시작해도 대문자로", () => {
    const p = assemblePrompt({ ...blocks, location: "outdoors, daytime, near a building wall" }, photo);
    expect(p).toContain(" Outdoors, daytime, near a building wall.");
  });
});

describe("시작·끝 이미지 (FL2VA)", () => {
  const se: AssembleContext = { ...photo, endFrame: true };
  const ok = (prompt: string, duration = 8) =>
    checkOutput({ profile, prompt, mode: "auto", inputWasSuggestive: false, endFrame: { duration } });

  it("공식 FL2VA 정렬 문장: 꺾쇠·대괄호 없음, 끝 초는 소수 둘째 자리", () => {
    expect(fl2vaAlignment(8)).toBe(
      "How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the 8.00-second mark of the target video.",
    );
    expect(fl2vaAlignment(12)).toContain("12.00-second mark");
  });

  it("정렬 문장이 바뀌고 동작 끝에 <Picture 2> 도착 문장이 한 번 붙는다", () => {
    const p = assemblePrompt(blocks, se);
    expect(p.split("\n")[0]).toBe(fl2vaAlignment(8));
    const d = p.split("\n")[2];
    expect(d.endsWith(END_FRAME_SENTENCE)).toBe(true);
    expect(d.match(/<Picture 2>/g)).toHaveLength(1);
    expect(ok(p)).toEqual([]);
  });

  it("모델이 쓴 <Picture 2>·<Picture 3>는 지우고 코드가 한 번만 넣는다", () => {
    const b = { ...blocks, segments: [{ start: 0, end: 8, action: "She stands up and ends as shown in <Picture 2>, like <Picture 3>" }] };
    const p = assemblePrompt(b, se);
    expect(p).not.toContain("<Picture 3>");
    expect(p.match(/<Picture 2>/g)).toHaveLength(1);
    expect(ok(p)).toEqual([]);
  });

  it("동작 안의 카메라 문장은 지운다 (카메라 문장은 한 곳만)", () => {
    const b = { ...blocks, segments: [{ start: 0, end: 8, action: "She turns. The camera pushes in slowly toward her. Then she waves." }] };
    const d = assemblePrompt(b, photo).split("\n")[2];
    expect(d).toContain("The camera stays static. She turns. Then she waves.");
    expect(d.match(/The camera/g)).toHaveLength(1);
  });

  it("사람이 중심이 아니면 빈칸 앞에 지칭어를 붙이지 않는다", () => {
    const p = assemblePrompt({ ...blocks, subject_noun: "none" }, { ...photo, personCentric: false, keyMode: "placeholder" });
    expect(p).toContain(`Then ${profile.placeholder}`);
    expect(p).not.toContain("the subject");
  });

  it("subject에 지칭어가 들어 있어도 한 번만", () => {
    const d = assemblePrompt({ ...blocks, subject: "the man in <Picture 1> wears black-rimmed glasses" }, photo).split("\n")[2];
    expect(d).toContain("Live-action, the woman in <Picture 1> wears black-rimmed glasses.");
    expect(d.match(/in <Picture 1>/g)).toHaveLength(1);
  });

  it("모델이 쓴 끝맺음 문장은 지우고 도착 문장만 남긴다", () => {
    const b = {
      ...blocks,
      segments: [
        { start: 0, end: 4, action: "The mist drifts across the hills. The shot ends on the final frame." },
        { start: 4, end: 8, action: "The fog shifts, partially hiding the mountains until the shot ends on the final frame." },
      ],
    };
    const d = assemblePrompt(b, se).split("\n")[2];
    expect(d).toContain("partially hiding the mountains. The shot ends on the final frame shown in <Picture 2>.");
    expect(d.match(/shot ends/g)).toHaveLength(1);
  });

  it("출력 검사: 도착 문장 없음, 없는 그림 참조, 길이 불일치는 위반", () => {
    const p = assemblePrompt(blocks, se);
    expect(ok(p.replace(END_FRAME_SENTENCE, ""))).toContain("PICTURE_REF");
    expect(ok(p.replace(END_FRAME_SENTENCE, `${END_FRAME_SENTENCE} <Picture 3>`))).toContain("PICTURE_REF");
    expect(ok(p, 10)).toContain("EMPTY"); // 정렬 문장의 끝 초가 영상 길이와 다름
  });

  it("한 장 모드에서 Picture 2가 나오면 위반, 한 장 결과는 그대로 통과", () => {
    const single = assemblePrompt(blocks, photo);
    const check = (prompt: string) => checkOutput({ profile, prompt, mode: "auto", inputWasSuggestive: false });
    expect(check(single)).toEqual([]);
    expect(check(single.replace("waves.", "waves like <Picture 2>."))).toContain("PICTURE_REF");
    // 한 장 결과를 두 장 검사에 넣으면 (정렬 문장이 다름) 위반
    expect(ok(single)).toContain("EMPTY");
  });
});
