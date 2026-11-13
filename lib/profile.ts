import h3 from "@/profiles/minimax-h3-i2v.json";

export type FieldKey =
  | "key_action"
  | "dialogue"
  | "appearance"
  | "scene"
  | "camera"
  | "lighting"
  | "mood"
  | "audio";

export type Pace = "slow" | "normal" | "fast";
export const PACES: Pace[] = ["slow", "normal", "fast"];

export type Profile = {
  profile: string;
  mode: string;
  label: string;
  guide: string;
  safety_module: string;
  placeholder: string;
  output_language: string;
  max_output_chars: number;
  duration: { min: number; max: number; default: number };
  aspect_ratios: string[];
  groups: { key: string; label: string; open: boolean }[];
  fields: { key: FieldKey; group: string; label: string; hint: string; tier: "basic" | "advanced" }[];
  paces: { key: Pace; label: string }[];
};

export const FIELD_KEYS: FieldKey[] = [
  "key_action",
  "dialogue",
  "appearance",
  "scene",
  "camera",
  "lighting",
  "mood",
  "audio",
];

/** 지금은 H3 하나. 확장 시 프로필 파일만 추가한다. */
export const PROFILES: Record<string, Profile> = {
  [h3.profile]: h3 as Profile,
};

export const DEFAULT_PROFILE = h3.profile;

export function getProfile(id: string) {
  return PROFILES[id];
}
