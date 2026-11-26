/**
 * 카메라 프리셋 → MiniMax H3 공식 카메라 문장 (동작 + 폭 + 속도).
 * 화면(드롭다운)과 서버가 같이 쓴다. 문장은 서버가 만들어 프롬프트에 그대로 넣는다(모델이 바꾸지 않음).
 * 보통 폭·보통 속도는 공식 문법대로 생략한다.
 */
export const CAMERA_MOTIONS = [
  "auto",
  "static",
  "push_in",
  "pull_out",
  "zoom_in",
  "zoom_out",
  "pan_left",
  "pan_right",
  "truck_left",
  "truck_right",
  "tilt_up",
  "tilt_down",
  "pedestal_up",
  "pedestal_down",
  "tracking",
  "arc",
  "shake_slight",
  "shake_strong",
  "pov",
  "roll_cw",
  "roll_ccw",
] as const;
export type CameraMotion = (typeof CAMERA_MOTIONS)[number];

export const CAMERA_AMPLITUDES = ["normal", "small", "large"] as const;
export type CameraAmplitude = (typeof CAMERA_AMPLITUDES)[number];
export const CAMERA_SPEEDS = ["normal", "slow", "fast"] as const;
export type CameraSpeed = (typeof CAMERA_SPEEDS)[number];

export type CameraPreset = { motion: CameraMotion; amplitude: CameraAmplitude; speed: CameraSpeed };

const BASE: Record<Exclude<CameraMotion, "auto">, string> = {
  static: "The camera stays static",
  push_in: "The camera pushes in",
  pull_out: "The camera pulls out",
  zoom_in: "The camera zooms in",
  zoom_out: "The camera zooms out",
  pan_left: "The camera pans left",
  pan_right: "The camera pans right",
  truck_left: "The camera trucks left",
  truck_right: "The camera trucks right",
  tilt_up: "The camera tilts up",
  tilt_down: "The camera tilts down",
  pedestal_up: "The camera pedestals up",
  pedestal_down: "The camera pedestals down",
  tracking: "The camera tracks the main subject as it moves",
  arc: "The camera arcs around the main subject",
  shake_slight: "The camera shakes slightly",
  shake_strong: "The camera shakes strongly",
  pov: "The shot is filmed as a POV shot",
  roll_cw: "The camera rolls clockwise",
  roll_ccw: "The camera rolls counterclockwise",
};

/** 폭·속도를 붙이지 않는 동작 (고정·흔들림·1인칭) */
const NO_MODIFIERS = new Set<CameraMotion>(["static", "shake_slight", "shake_strong", "pov"]);

/** 프리셋 → 공식 문장. auto(요청·카메라 칸대로)면 null */
export function cameraSentence(p: CameraPreset): string | null {
  if (p.motion === "auto") return null;
  let s = BASE[p.motion];
  if (!NO_MODIFIERS.has(p.motion)) {
    if (p.amplitude !== "normal") s += ` with ${p.amplitude} amplitude`;
    if (p.speed !== "normal") s += ` at ${p.speed} speed`;
  }
  return `${s}.`;
}

/** 폼 값 검증 (목록에 없으면 기본값) */
export function parseCameraPreset(motion: unknown, amplitude: unknown, speed: unknown): CameraPreset {
  const pick = <T extends readonly string[]>(list: T, v: unknown, d: T[number]): T[number] =>
    (list as readonly string[]).includes(String(v)) ? (String(v) as T[number]) : d;
  return {
    motion: pick(CAMERA_MOTIONS, motion, "auto"),
    amplitude: pick(CAMERA_AMPLITUDES, amplitude, "normal"),
    speed: pick(CAMERA_SPEEDS, speed, "normal"),
  };
}
