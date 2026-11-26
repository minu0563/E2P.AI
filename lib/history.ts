import type { FieldKey, Pace } from "@/lib/profile";
import type { CameraPreset } from "@/lib/camera";

/** 생성 당시 입력값 (GenerationLog.input). 클라이언트에서도 쓰는 타입 */
export type HistoryInput = {
  inputMode: "natural" | "fields";
  request: string;
  fields: Partial<Record<FieldKey, string>>;
  placeholder: boolean;
  duration: number;
  aspectRatio: string;
  pace: Pace;
  /** 연출 설정 (예전 기록에는 없음) */
  camera?: CameraPreset;
  gaze?: "auto" | "camera";
  dialogueMode?: "on_screen" | "voiceover";
};

export type HistoryItem = {
  id: string;
  createdAt: string;
  outcome: string;
  requestText: string;
  prompt: string | null;
  input: HistoryInput | null;
};
