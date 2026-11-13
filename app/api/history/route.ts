import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { HistoryInput, HistoryItem } from "@/lib/history";

/** 내 생성 기록. ?id=요청ID 이면 한 건, 없으면 최근 30건 (본인 것, 성공한 것만) */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, code: "LOGIN_REQUIRED" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  const rows = await db.generationLog.findMany({
    // 성공한 생성만 (거절·오류·취소는 다시 열 이유가 없다)
    where: { userId: user.id, outcome: "ok", ...(id && { requestId: id }) },
    orderBy: { createdAt: "desc" },
    take: id ? 1 : 30,
    select: { requestId: true, createdAt: true, outcome: true, requestText: true, prompt: true, input: true },
  });
  const items: HistoryItem[] = rows.map((r) => ({
    id: r.requestId,
    createdAt: r.createdAt.toISOString(),
    outcome: r.outcome,
    requestText: r.requestText,
    prompt: r.prompt,
    input: r.input as HistoryInput | null,
  }));
  if (id && !items.length) return Response.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true, items });
}
