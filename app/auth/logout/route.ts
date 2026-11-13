import { endSession } from "@/lib/auth";
import { forbidden, isSameOrigin } from "@/lib/security";

/**
 * 로그아웃 (POST만). 언어 rewrite(proxy)를 거치는 페이지의 서버 액션은 요청이 깨질 수 있어
 * proxy 대상이 아닌 /auth 아래 일반 라우트로 둔다. 세션 쿠키가 SameSite=Lax라 다른 사이트의 POST로는 로그아웃되지 않는다.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  await endSession();
  return Response.redirect(new URL("/", request.url), 303);
}
