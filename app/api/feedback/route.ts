import * as z from "zod";
import { getCurrentUser } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { forbidden, isSameOrigin } from "@/lib/security";

const Body = z.object({
  requestId: z.uuid(),
  kind: z.enum(["copy", "like", "dislike"]),
});

/** 복사·만족/불만족 피드백 (이미지 원본 없음). TODO(DB 단계): 테이블 저장 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!(await hit(`feedback:${user.id}`, 30, 60))) return Response.json({ ok: false }, { status: 429 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  console.log(`[feedback] ${JSON.stringify({ ...parsed.data, userId: user.id })}`);
  return Response.json({ ok: true });
}
