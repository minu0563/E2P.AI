import type { MetadataRoute } from "next";

// 주소(APP_URL)는 배포 환경 변수라 요청 때 만든다
export const dynamic = "force-dynamic";

/** 검색 엔진: 공개 페이지만. 로그인 뒤 화면·API·관리자는 막는다 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/auth/", "/me", "/generate", "/inquiry", "/login"] },
    ...(base && { sitemap: `${base}/sitemap.xml` }),
  };
}
