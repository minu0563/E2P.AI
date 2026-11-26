import { describe, expect, it } from "vitest";
import { CAMERA_MOTIONS, cameraSentence, parseCameraPreset } from "@/lib/camera";

describe("카메라 프리셋 → 공식 문장", () => {
  it("동작 + 폭 + 속도, 보통은 생략", () => {
    expect(cameraSentence({ motion: "push_in", amplitude: "small", speed: "slow" })).toBe("The camera pushes in with small amplitude at slow speed.");
    expect(cameraSentence({ motion: "pan_left", amplitude: "normal", speed: "fast" })).toBe("The camera pans left at fast speed.");
    expect(cameraSentence({ motion: "zoom_out", amplitude: "large", speed: "normal" })).toBe("The camera zooms out with large amplitude.");
    expect(cameraSentence({ motion: "tracking", amplitude: "normal", speed: "normal" })).toBe("The camera tracks the main subject as it moves.");
  });
  it("자동은 null, 고정·흔들림·1인칭은 폭·속도를 붙이지 않는다", () => {
    expect(cameraSentence({ motion: "auto", amplitude: "large", speed: "fast" })).toBeNull();
    expect(cameraSentence({ motion: "static", amplitude: "large", speed: "fast" })).toBe("The camera stays static.");
    expect(cameraSentence({ motion: "shake_slight", amplitude: "large", speed: "slow" })).toBe("The camera shakes slightly.");
    expect(cameraSentence({ motion: "pov", amplitude: "small", speed: "slow" })).toBe("The shot is filmed as a POV shot.");
  });
  it("모든 동작이 문장을 가진다", () => {
    for (const m of CAMERA_MOTIONS.filter((x) => x !== "auto")) {
      expect(cameraSentence({ motion: m, amplitude: "normal", speed: "normal" })).toMatch(/^The (camera|shot) .+\.$/);
    }
  });
  it("폼 값 검증: 목록에 없으면 기본값", () => {
    expect(parseCameraPreset("push_in", "small", "slow")).toEqual({ motion: "push_in", amplitude: "small", speed: "slow" });
    expect(parseCameraPreset("<script>", "huge", null)).toEqual({ motion: "auto", amplitude: "normal", speed: "normal" });
  });
});
