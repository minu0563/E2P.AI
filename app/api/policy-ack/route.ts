import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { forbidden, isSameOrigin } from "@/lib/security";

/** 첫 생성 전 이용약관·허용 정책 확인 기록 (현재 약관 버전) */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, code: "LOGIN_REQUIRED" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { confirm?: boolean } | null;
  if (body?.confirm !== true) return Response.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
  await db.user.update({
    where: { id: user.id },
    data: { policyAckVersion: process.env.TERMS_VERSION!, policyAckAt: new Date() },
  });
  return Response.json({ ok: true });
}
