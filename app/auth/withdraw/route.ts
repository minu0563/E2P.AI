import { getCurrentUser, withdrawUser } from "@/lib/auth";
import { forbidden, isSameOrigin } from "@/lib/security";

/**
 * 탈퇴 (POST만, 같은 사이트 요청 + 확인 체크 필수). 로그아웃과 같은 이유로 /auth 아래 일반 라우트.
 * 기록은 지우지 않는다(보관 기간 뒤 파기). 같은 Google 계정으로 다시 로그인하면 계정이 되살아난다.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return Response.redirect(new URL("/login", request.url), 303);
  const form = await request.formData().catch(() => null);
  if (form?.get("confirm") !== "yes") return Response.redirect(new URL("/me?withdraw=confirm", request.url), 303);
  await withdrawUser(user.id);
  return Response.redirect(new URL("/?withdrawn=1", request.url), 303);
}
