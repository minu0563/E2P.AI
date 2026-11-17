/** 서비스명: E2P.AI = Everything to Prompt. 모델명(MiniMax/H3)은 이름에 넣지 않는다(설명용으로만). */
export const SITE = {
  name: "E2P.AI",
  short: "E2P",
  expansion: "Everything to Prompt",
  tagline: "Turn anything into a prompt.",
  slogan: "One place. Every creative prompt.",
  contactEmail: "contact@example.com", // TODO: 실제 문의 주소
};

/** 법률 문서에 들어갈 운영자 정보. TODO(출시 전): 사업자 등록 후 실제 값으로 */
export const LEGAL = {
  operator: "[운영자/상호]",
  operatorEn: "[Operator name]",
  representative: "[대표자]",
  bizNumber: "[사업자등록번호]",
  mailOrderNumber: "[통신판매업 신고번호]",
  address: "[사업장 주소]",
  privacyOfficer: "[개인정보 보호책임자]",
  effective: "2026-11-17",
};

/** 라벨은 사전(dict.nav / dict.footer)의 키 */
export const NAV = [
  { href: "/generate", key: "generate" },
  { href: "/guide", key: "guide" },
  { href: "/faq", key: "faq" },
] as const;

export const FOOTER_LINKS = [
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
  { href: "/terms", key: "terms" },
  { href: "/privacy", key: "privacy" },
  { href: "/refund", key: "refund" },
  { href: "/policy", key: "policy" },
] as const;
