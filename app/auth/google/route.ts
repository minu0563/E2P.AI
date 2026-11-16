import { cookies } from "next/headers";
import appConfig from "@/config/app.json";
import { OAUTH_COOKIE, createAuthRequest, safeNext } from "@/lib/google";
import { clientIp, hit } from "@/lib/limits";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const agree = params.get("agree") === "1";
  const next = safeNext(params.get("next"));
  if (!(await hit(`login:${clientIp(request)}`, appConfig.rate_limit.login_ip_per_minute, 60))) {
    return Response.redirect(new URL("/login?error=rate", request.url), 302);
  }

  let auth;
  try {
    auth = createAuthRequest();
  } catch (e) {
    console.error("[auth] google not configured", String(e));
    return Response.redirect(new URL("/login?error=config", request.url), 302);
  }
  (await cookies()).set(OAUTH_COOKIE, JSON.stringify({ s: auth.state, v: auth.verifier, a: agree, n: next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 600,
  });
  return Response.redirect(auth.url, 302);
}
