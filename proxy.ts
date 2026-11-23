import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, localeFromAcceptLanguage } from "@/lib/i18n/config";

/**
 * 언어 라우팅. 언어 없는 주소(/generate)는 내부에서 /ko/generate · /en/generate로 rewrite.
 * - 쿠키(lang)가 있으면 그 언어 (사용자가 직접 바꾼 경우)
 * - 없으면 브라우저 언어(Accept-Language)가 한국어면 ko, 그 외 en
 * - /ko/... · /en/... 는 그 언어로 그대로 보여주고 쿠키에 저장 (언어 전환 링크, 검색 결과 주소)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 관리자 화면: 로그인 쿠키가 없으면 바로 404 (관리자 여부는 화면에서 다시 확인)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const loggedIn = request.cookies.has("session") || request.cookies.has("__Host-session");
    return loggedIn ? NextResponse.next() : new NextResponse("Not Found", { status: 404 });
  }
  const first = pathname.split("/")[1];

  if (isLocale(first)) {
    // 언어별 주소는 그대로 보여준다 (검색 엔진이 언어마다 따로 색인). 사람이 고른 언어로 보고 쿠키에도 저장
    const res = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      res.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : localeFromAcceptLanguage(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // API·인증 라우트·정적 파일은 제외 (관리자는 위에서 따로 처리)
  matcher: ["/((?!api|auth|_next|.*\\..*).*)"],
};
