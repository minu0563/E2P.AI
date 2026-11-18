import { getCurrentUser } from "@/lib/auth";
import { INQUIRY_PER_DAY, InquiryInput, createInquiry } from "@/lib/inquiry";
import { hit } from "@/lib/limits";
import { forbidden, isSameOrigin } from "@/lib/security";

/** 문의 접수. 로그인 사용자만, 하루 INQUIRY_PER_DAY건 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, code: "LOGIN_REQUIRED" }, { status: 401 });

  const parsed = InquiryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });

  // 형식이 맞는 요청만 한도에 센다
  if (!(await hit(`inquiry:${user.id}`, INQUIRY_PER_DAY, 86_400))) {
    return Response.json({ ok: false, code: "RATE_LIMITED" }, { status: 429 });
  }
  const r = await createInquiry(user.id, parsed.data);
  if (!r.ok) return Response.json({ ok: false, code: r.code }, { status: r.code === "NOT_FOUND" ? 404 : 409 });
  return Response.json({ ok: true, id: r.id });
}
