import * as z from "zod";

const Body = z.object({
  requestId: z.uuid(),
  kind: z.enum(["copy", "like", "dislike"]),
});

/** 복사·만족/불만족 피드백 (이미지 원본 없음). TODO(DB 단계): 테이블 저장 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  console.log(`[feedback] ${JSON.stringify(parsed.data)}`);
  return Response.json({ ok: true });
}
