import { cookies } from "next/headers";
import { OAUTH_COOKIE, createAuthRequest, safeNext } from "@/lib/google";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const agree = params.get("agree") === "1";
  const next = safeNext(params.get("next"));

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
