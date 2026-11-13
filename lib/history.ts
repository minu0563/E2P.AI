import type { FieldKey, Pace } from "@/lib/profile";

/** 생성 당시 입력값 (GenerationLog.input). 클라이언트에서도 쓰는 타입 */
export type HistoryInput = {
  inputMode: "natural" | "fields";
  request: string;
  fields: Partial<Record<FieldKey, string>>;
  placeholder: boolean;
  duration: number;
  aspectRatio: string;
  pace: Pace;
};

export type HistoryItem = {
  id: string;
  createdAt: string;
  outcome: string;
  requestText: string;
  prompt: string | null;
  input: HistoryInput | null;
};
