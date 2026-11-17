import { cookies } from "next/headers";
import { hasCurrentConsent, recordConsent, startSession, upsertGoogleUser } from "@/lib/auth";
import { OAUTH_COOKIE, exchangeCode, safeNext } from "@/lib/google";
import { finishReauth, type ReauthState } from "@/system/admin/reauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = (path: string) => Response.redirect(new URL(path, request.url), 302);
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/auth/google" });

  let saved: { s: string; v: string; a: boolean; n: string } | ({ s: string; v: string } & ReauthState);
  try {
    saved = JSON.parse(raw ?? "");
  } catch {
    return to("/login?error=expired");
  }
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== saved.s) return to("/login?error=state");

  // 관리자 이미지 열람용 다시 로그인: 로그인 세션은 그대로 두고 열람 세션만 만든다
  if ("m" in saved) {
    try {
      return await finishReauth(request, saved, await exchangeCode(code, saved.v));
    } catch (e) {
      console.error("[auth] reauth failed", String(e).slice(0, 200));
      return to("/admin/images?error=reauth");
    }
  }

  try {
    const identity = await exchangeCode(code, saved.v);
    const user = await upsertGoogleUser(identity);
    if (user.suspendedAt) return to("/login?error=suspended");
    if (saved.a) await recordConsent(user.id);
    else if (!(await hasCurrentConsent(user.id))) return to("/login?error=consent");
    await startSession(user.id);
    return to(safeNext(saved.n));
  } catch (e) {
    console.error("[auth] google callback failed", String(e).slice(0, 200));
    return to("/login?error=google");
  }
}
