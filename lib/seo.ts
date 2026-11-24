import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { SITE } from "@/lib/site";

/**
 * 검색 엔진용 메타데이터.
 * - 언어별 주소: /ko/... · /en/... (검색 엔진이 언어마다 따로 색인). 언어 없는 주소(/guide)는 사람용 — 쿠키·브라우저 언어로 고른다.
 * - canonical은 항상 언어별 주소, x-default는 영어.
 * - 절대 주소는 APP_URL(배포 vars)로 만든다. 없으면(로컬) 상대 주소.
 */
export function siteUrl(): string | null {
  return process.env.APP_URL?.replace(/\/$/, "") || null;
}

export const localePath = (locale: Locale, path: string) => `/${locale}${path === "/" ? "" : path}`;

export function alternates(path: string, locale: Locale): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
      "x-default": localePath("en", path),
    },
  };
}

export const HOME_META = {
  // 설명이 너무 짧으면 Google이 본문(영상 설명 등)을 대신 잘라 쓴다 → 한두 문장(약 80~150자)으로
  ko: {
    title: `${SITE.name} - Prompt Generator`,
    description:
      "E2P.AI(Everything to Prompt)는 이미지 한 장과 짧은 요청을 영상 생성 모델용 프롬프트로 바꿔 주는 무료 프롬프트 생성기입니다. 이미지·영상은 만들지 않고 프롬프트 텍스트만 제공합니다.",
  },
  en: {
    title: `${SITE.name} - Prompt Generator`,
    description:
      "E2P.AI (Everything to Prompt) turns one image and a short request into a ready-to-use prompt for video generation models. Free, and prompt text only: no images or videos are generated.",
  },
} as const;

/** 공유 카드 공통값 (자식 페이지의 openGraph는 부모 것을 통째로 덮으므로 매번 같이 넣는다) */
export function openGraphBase(locale: Locale): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    siteName: SITE.name,
    locale: locale === "ko" ? "ko_KR" : "en_US",
    alternateLocale: locale === "ko" ? "en_US" : "ko_KR",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE.name }],
  };
}

/** 공개 페이지 메타데이터: 제목·설명 + canonical·hreflang + 공유 카드 */
export async function pageMeta(
  path: string,
  m: Record<Locale, { title?: string; description?: string }>,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = m[locale];
  const ogTitle = t.title ? (t.title.startsWith(SITE.name) ? t.title : `${t.title} · ${SITE.name}`) : HOME_META[locale].title;
  const description = t.description ?? HOME_META[locale].description;
  return {
    ...(t.title && { title: t.title.startsWith(SITE.name) ? { absolute: t.title } : t.title }),
    ...(t.description && { description: t.description }),
    alternates: alternates(path, locale),
    openGraph: { ...openGraphBase(locale), title: ogTitle, description, url: localePath(locale, path) },
    twitter: { card: "summary_large_image", title: ogTitle, description, images: ["/og.png"] },
  };
}

/** 이동 경로 구조화 데이터 (검색 결과에 "E2P.AI › 가이드 › MiniMax H3"처럼 표시). items: [이름, 경로] */
export function breadcrumbJsonLd(locale: Locale, items: [string, string][]) {
  const base = siteUrl();
  if (!base) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${base}${localePath(locale, path)}`,
    })),
  };
}

/** 첫 화면 구조화 데이터 (검색 결과의 사이트 이름·로고). 절대 주소가 필요해서 APP_URL이 없으면 넣지 않는다 */
export function homeJsonLd(locale: Locale) {
  const base = siteUrl();
  if (!base) return null;
  const url = `${base}${localePath(locale, "/")}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      alternateName: [SITE.short, SITE.expansion, "E2P AI"],
      url: `${base}/`,
      inLanguage: locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: `${base}/`,
      logo: `${base}/icon.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE.name,
      alternateName: SITE.short,
      url,
      description: HOME_META[locale].description,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      inLanguage: locale,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ];
}
