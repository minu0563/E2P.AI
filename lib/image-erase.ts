import "server-only";
import { db } from "@/lib/db";
import { deleteImagesExceptHold } from "@/platform/image-store";

/**
 * 이미지 삭제 요청 처리 (탈퇴·사진 속 당사자 요청). 사람 검토 영역.
 * - 수사기관 보존(hold) 건은 지우지 않고 개수만 알린다 (개인정보처리방침: "수사기관 보존 요청 건 제외").
 * - 저장소(R2)에서 먼저 지우고, 성공했을 때만 기록의 보관 칸을 비운다. 저장소에 연결할 수 없으면 아무것도 바꾸지 않는다.
 * - 판정값·이미지 해시(우회 방지)는 텍스트 기록이라 남긴다. 이미지 자체만 지운다.
 */
export type EraseTarget = { userId: string } | { requestId: string };
export type EraseResult = { ok: true; deleted: number; held: number } | { ok: false; code: "STORE_UNAVAILABLE" };

export async function eraseImages(
  target: EraseTarget,
  removeFromStore: (requestIds: string[]) => Promise<boolean> = deleteImagesExceptHold,
): Promise<EraseResult> {
  const rows = await db.generationLog.findMany({
    where: { ...target, imageTier: { not: null } },
    select: { requestId: true, imageTier: true },
  });
  const held = rows.filter((r) => r.imageTier === "hold").length;
  const ids = rows.filter((r) => r.imageTier !== "hold").map((r) => r.requestId);
  if (ids.length === 0) return { ok: true, deleted: 0, held };

  if (!(await removeFromStore(ids))) return { ok: false, code: "STORE_UNAVAILABLE" };
  // 사이에 hold로 옮겨진 건은 건드리지 않는다
  const r = await db.generationLog.updateMany({
    where: { requestId: { in: ids }, imageTier: { not: "hold" } },
    data: { imageTier: null, imageStoredAt: null, imageExpiresAt: null },
  });
  return { ok: true, deleted: r.count, held };
}
