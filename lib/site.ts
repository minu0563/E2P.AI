/** 서비스명: E2P.AI = Everything to Prompt. 모델명(MiniMax/H3)은 이름에 넣지 않는다(설명용으로만). */
export const SITE = {
  name: "E2P.AI",
  short: "E2P",
  expansion: "Everything to Prompt",
  tagline: "Turn anything into a prompt.",
  slogan: "One place. Every creative prompt.",
  contactEmail: "contact@e2pai.app", // Cloudflare Email Routing → 운영자 메일함
};

/** 법률 문서에 들어갈 운영자 정보. 화면에는 operator·privacyOfficer만 나온다. 나머지는 사업자 등록 후 채운다 */
export const LEGAL = {
  operator: "E2P",
  operatorEn: "E2P",
  representative: "[대표자]",
  bizNumber: "[사업자등록번호]",
  mailOrderNumber: "[통신판매업 신고번호]",
  address: "[사업장 주소]",
  // 개인정보 보호책임자: 실명 표기가 필요한지 변호사 확인 (지금은 운영자 표시 + 문의 메일)
  privacyOfficer: "E2P 운영자",
  privacyOfficerEn: "E2P operator",
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
