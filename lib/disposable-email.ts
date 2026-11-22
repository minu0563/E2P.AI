import list from "@/config/disposable-email-domains.json";

const DOMAINS = new Set(list.domains.map((d) => d.toLowerCase()));

/** 일회용 메일 주소인지 (도메인 또는 그 하위 도메인이 목록에 있으면 true) */
export function isDisposableEmail(email: string) {
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  if (!domain) return false;
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (DOMAINS.has(parts.slice(i).join("."))) return true;
  return false;
}
