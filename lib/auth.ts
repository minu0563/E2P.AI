import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { grantSignupCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { isDisposableEmail } from "@/lib/disposable-email";
import type { GoogleIdentity } from "@/lib/google";

// 운영(HTTPS)에서는 __Host- 접두사: Secure·Path=/·도메인 고정이 강제되어 하위 도메인에서 덮어쓸 수 없다
const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-session" : "session";
const SESSION_DAYS = 30;

const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

/** 일회용 메일로 새로 가입하려는 경우 (기존 계정은 로그인 허용) */
export class DisposableEmailError extends Error {}

/** Google 계정으로 사용자 생성/조회. 처음 가입이면 무료 크레딧 지급. 일회용 메일로는 새로 가입할 수 없다. */
export async function upsertGoogleUser(g: GoogleIdentity) {
  const existing =
    (await db.user.findUnique({ where: { googleSub: g.sub } })) ??
    (await db.user.findUnique({ where: { email: g.email } }));
  if (!existing && isDisposableEmail(g.email)) throw new DisposableEmailError();
  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { googleSub: g.sub, email: g.email, name: g.name, verifiedAt: existing.verifiedAt ?? new Date() },
      })
    : await db.user.create({ data: { googleSub: g.sub, email: g.email, name: g.name, verifiedAt: new Date() } });
  // 멱등성 키(signup:userId)로 한 번만 지급
  await grantSignupCredits(user.id);
  return user;
}

export async function hasCurrentConsent(userId: string) {
  return !!(await db.consent.findUnique({
    where: { userId_version: { userId, version: process.env.TERMS_VERSION! } },
  }));
}

export async function startSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({
    data: { userId, tokenHash: hash(token), expiresAt },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** 로그인 쿠키가 있는지만 (DB 조회 없음). 익명 요청을 DB 전에 거르는 용도 — 권한 판단은 getCurrentUser로 */
export async function hasSessionCookie() {
  return (await cookies()).has(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.suspendedAt) return null; // 정지된 계정 (관리자 화면에서 정지 시 세션도 지운다)
  return session.user;
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete(SESSION_COOKIE);
}

/** 현재 약관 버전 동의 기록 (동의 시각·버전) */
export async function recordConsent(userId: string) {
  const version = process.env.TERMS_VERSION!;
  await db.consent.upsert({
    where: { userId_version: { userId, version } },
    create: { userId, version },
    update: {},
  });
}
