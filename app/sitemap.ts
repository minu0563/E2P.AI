import type { MetadataRoute } from "next";

// 주소(APP_URL)는 배포 환경 변수라 요청 때 만든다
export const dynamic = "force-dynamic";

/** 공개 페이지 목록 (언어는 주소에 넣지 않으므로 페이지당 하나) */
const PAGES = ["/", "/guide", "/faq", "/about", "/contact", "/terms", "/privacy", "/refund", "/policy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL;
  if (!base) return []; // 주소를 모르면 잘못된 주소를 알리지 않는다 (운영 vars에 APP_URL 필요)
  return PAGES.map((p) => ({ url: `${base}${p === "/" ? "" : p}`, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.6 }));
}
