import imagesConfig from "@/config/images.json";
import type { Judgment } from "@/lib/pipeline";

/**
 * 이미지 보관 폴더 결정 (사람이 직접 검토할 안전 규칙 영역).
 * - recent: 모든 이미지 72시간 (성공·오류·취소 포함)
 * - blocked: 정책 차단 30일 (관리자 열람 가능 — 오탐 점검용)
 * - quarantine: 법령 위반 의심 30일 (열람 불가, 사유 입력 후 내려받기만). 스위치가 꺼져 있으면 **아예 저장하지 않는다** (recent로도 넣지 않음)
 * 판정할 근거가 없는데(이미지 분석 없이 키워드로 차단) 요청이 성적이면 이미지를 확인할 수 없으므로 격리 쪽으로 본다 (보수적).
 */
export type ImageTier = "recent" | "blocked" | "quarantine";

type Outcome = "ok" | "block" | "error" | "cancel";

export function isQuarantineClass(blockCode: string | null, j: Judgment | null): boolean {
  const img = j?.image ?? null;
  // 시작·끝 모드: 두 이미지를 모두 본다 (끝 이미지만 위험한 경우도 격리 쪽)
  const imgs = [img, ...(j?.imageEnd ? [j.imageEnd] : [])].filter((x) => x != null);
  const kw = j?.keywords ?? {};
  const has = (k: string) => (kw[k]?.length ?? 0) > 0;

  if (blockCode === "SEXUAL_IMAGE") return true;
  if (imgs.some((x) => x.sexual_content === "explicit")) return true;

  const minor = imgs.some((x) => x.age_assessment === "possibly_minor" || x.age_assessment === "ambiguous") || has("minor");
  const sexual =
    imgs.some((x) => x.sexual_content !== "none") ||
    (j?.request != null && j.request.request_level !== "general") ||
    has("explicit") ||
    has("suggestive") ||
    j?.rule?.flags?.imageSexualWithRequest != null;
  if (minor && sexual) return true;

  // 이미지 판정 없이 성적 요청으로 막혔거나, 차단 이력 이미지로 빈칸 모드 우회를 시도한 경우: 이미지를 확인할 수 없다
  if (!img && (blockCode === "SEXUAL_REQUEST" || blockCode === "MODE_RESTRICTED")) return true;
  return false;
}

export function decideTier(
  outcome: Outcome,
  blockCode: string | null,
  j: Judgment | null,
  cfg: { store_enabled: boolean; quarantine_enabled: boolean } = imagesConfig,
): ImageTier | null {
  if (!cfg.store_enabled) return null;
  if (isQuarantineClass(blockCode, j)) return cfg.quarantine_enabled ? "quarantine" : null;
  if (outcome === "block" && blockCode !== "SYSTEM_ERROR") return "blocked";
  return "recent";
}

export function expiresAt(tier: ImageTier, from = new Date()): Date {
  return new Date(from.getTime() + imagesConfig.retention_days[tier] * 86_400_000);
}
