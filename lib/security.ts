import "server-only";

/**
 * 상태를 바꾸는 요청(POST·DELETE)이 우리 사이트에서 온 것인지 확인한다 (CSRF 방어 2중: SameSite 쿠키 + Origin).
 * - Origin 헤더가 있으면 APP_URL 또는 요청 호스트와 같아야 한다.
 * - 없으면 Sec-Fetch-Site가 same-origin/none일 때만 허용 (둘 다 없으면 브라우저가 아닌 요청 → 거부).
 */
export function isSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = new Set([new URL(req.url).origin]);
    if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
    return allowed.has(origin);
  }
  const site = req.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}

export const forbidden = () => Response.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
