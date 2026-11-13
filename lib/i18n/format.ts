/** "{n}개" 같은 자리 채우기 (서버·클라이언트 공용) */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function fmtDate(d: Date | string, locale: string) {
  return new Date(d).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtNumber(n: number, locale: string) {
  return n.toLocaleString(locale === "ko" ? "ko-KR" : "en-US");
}
