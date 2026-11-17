/**
 * Google 로그인 (OAuth 2.0 + OpenID Connect, 인가 코드 + PKCE). 사람이 직접 검토할 코드.
 * id_token은 서버가 Google 토큰 엔드포인트에서 TLS로 직접 받으므로 서명 검증 대신
 * iss·aud·exp·email_verified를 확인한다 (OIDC Core 3.1.3.7).
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const OAUTH_COOKIE = "g_oauth";

/** 내부 경로만 허용 (오픈 리다이렉트 방지) */
export const safeNext = (v: string | null) => (v && /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) ? v : "/generate");

export const redirectUri = () => `${process.env.APP_URL}/auth/google/callback`;

function clientId() {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set");
  return id;
}

/**
 * reauth: 관리자 이미지 열람용 다시 로그인. Google이 계정 선택이 아니라 실제 로그인을 다시 요구하게 하고(prompt=login),
 * max_age=0으로 id_token에 auth_time(실제 로그인 시각)을 받아 서버가 "방금 로그인했는지"를 확인한다.
 */
export function createAuthRequest(opts: { reauth?: { loginHint: string } } = {}) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(opts.reauth
      ? { prompt: "login", max_age: "0", login_hint: opts.reauth.loginHint }
      : { prompt: "select_account" }),
  }).toString();
  return { url: url.toString(), state, verifier };
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string | null;
  /** 실제 로그인 시각(초). max_age를 보낸 요청에만 들어온다 */
  authTime?: number;
};

export async function exchangeCode(code: string, verifier: string): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("no id_token");

  const claims = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString("utf8")) as {
    iss: string;
    aud: string;
    exp: number;
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    auth_time?: number;
  };
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new Error("bad iss");
  if (claims.aud !== clientId()) throw new Error("bad aud");
  if (claims.exp * 1000 < Date.now()) throw new Error("expired");
  if (!claims.email || claims.email_verified !== true) throw new Error("email not verified");
  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    name: claims.name ?? null,
    ...(typeof claims.auth_time === "number" && { authTime: claims.auth_time }),
  };
}
