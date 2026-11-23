import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/seo";

// 주소(APP_URL)는 배포 환경 변수라 요청 때 만든다
export const dynamic = "force-dynamic";

/** 로그인 뒤 화면 (언어 없는 주소와 /ko/..., /en/... 모두) */
const PRIVATE = ["/me", "/generate", "/inquiry", "/login"];

/** 검색 엔진: 공개 페이지만. 로그인 뒤 화면·API·관리자는 막는다 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const disallow = ["/admin", "/api/", "/auth/", ...PRIVATE, ...LOCALES.flatMap((l) => PRIVATE.map((p) => `/${l}${p}`))];
  return {
    rules: { userAgent: "*", allow: "/", disallow },
    ...(base && { sitemap: `${base}/sitemap.xml` }),
  };
}
