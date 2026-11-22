import "server-only";

/**
 * Cloudflare Turnstile (봇 방지). 로그인 시작 전에 확인한다 (인증 영역 — 사람 검토).
 * - 사이트 키(TURNSTILE_SITE_KEY, 공개값)는 wrangler vars, 비밀 키(TURNSTILE_SECRET)는 Workers Secrets / .dev.vars.
 * - 둘 다 없으면 확인을 건너뛴다(로컬 개발). 사이트 키만 있고 비밀 키가 없으면 실패(fail-closed).
 * - 로컬에서 동작을 시험하려면 Cloudflare 공개 테스트 키(항상 통과)를 쓴다:
 *   TURNSTILE_SITE_KEY=1x00000000000000000000AA, TURNSTILE_SECRET=1x0000000000000000000000000000000AA
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY || null;
}

export type TurnstileResult = "ok" | "skipped" | "failed";

export async function verifyTurnstile(token: string | null, ip: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret && !turnstileSiteKey()) {
    console.warn("[turnstile] not configured; skipping");
    return "skipped";
  }
  if (!secret || !token || token.length > 2048) return "failed";
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "local") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean; action?: string };
    return data.success === true && (!data.action || data.action === "login") ? "ok" : "failed";
  } catch (e) {
    console.error("[turnstile] verify error", String(e).slice(0, 200));
    return "failed";
  }
}
