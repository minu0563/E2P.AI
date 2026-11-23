import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { localePath, siteUrl } from "@/lib/seo";

// 주소(APP_URL)는 배포 환경 변수라 요청 때 만든다
export const dynamic = "force-dynamic";

/** 공개 페이지 목록. 언어별 주소(/ko/..., /en/...)를 모두 알리고 서로를 언어 대체 주소로 묶는다 */
const PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/guide", priority: 0.8, changeFrequency: "monthly" },
  { path: "/guide/minimax-h3", priority: 0.9, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.2, changeFrequency: "yearly" },
  { path: "/policy", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  if (!base) return []; // 주소를 모르면 잘못된 주소를 알리지 않는다 (운영 vars에 APP_URL 필요)
  return PAGES.flatMap(({ path, priority, changeFrequency }) => {
    const languages = Object.fromEntries(LOCALES.map((l) => [l, `${base}${localePath(l, path)}`]));
    return LOCALES.map((l) => ({
      url: `${base}${localePath(l, path)}`,
      changeFrequency,
      priority,
      alternates: { languages: { ...languages, "x-default": `${base}${localePath("en", path)}` } },
    }));
  });
}
