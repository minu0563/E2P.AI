import * as z from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hit } from "@/lib/limits";
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
  // 본인 생성 건에만 (남의 요청 ID로 피드백 통계를 오염시키지 못하게). 기록이 없는 관리자 생성 건도 여기서 걸러진다
  const own = await db.generationLog.findUnique({ where: { requestId: parsed.data.requestId }, select: { userId: true } });
  if (own?.userId !== user.id) return Response.json({ ok: false }, { status: 404 });
  console.log(`[feedback] ${JSON.stringify({ ...parsed.data, userId: user.id })}`);
  return Response.json({ ok: true });
}
