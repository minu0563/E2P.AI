/** 지원 언어. 브라우저(구글 계정/크롬) 언어가 한국어면 ko, 그 외는 en. proxy에서도 쓰므로 server-only 아님 */
export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const isLocale = (v: string | undefined | null): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

/** Accept-Language 중 가장 우선순위가 높은 언어가 한국어면 ko */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const top = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.tag && x.tag !== "*")
    .sort((a, b) => b.q - a.q)[0];
  return top?.tag.startsWith("ko") ? "ko" : "en";
}
