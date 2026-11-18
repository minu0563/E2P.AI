import "server-only";
import * as z from "zod";
import { db } from "@/lib/db";

/**
 * 사용자 문의. 생성 건에 연결하면 관리자가 그때 이미지(보관 중이면)·판정·프롬프트를 함께 본다.
 * - 자기 생성 건에만 연결할 수 있다 (남의 요청 ID를 넣으면 거절).
 * - 같은 생성 건에는 문의 1건 (중복 접수 방지).
 * - 하루 접수 수는 호출 측(라우트)이 속도 제한으로 막는다.
 */
export const INQUIRY_CATEGORIES = ["appeal", "quality", "deletion", "other"] as const;
export const INQUIRY_MAX_CHARS = 1000;
export const INQUIRY_PER_DAY = 5;

export const InquiryInput = z.object({
  requestId: z.uuid().optional(),
  category: z.enum(INQUIRY_CATEGORIES),
  body: z.string().trim().min(5).max(INQUIRY_MAX_CHARS),
});

export type CreateInquiryResult =
  | { ok: true; id: string }
  | { ok: false; code: "NOT_FOUND" | "DUPLICATE" };

export async function createInquiry(userId: string, input: z.infer<typeof InquiryInput>): Promise<CreateInquiryResult> {
  if (input.requestId) {
    const log = await db.generationLog.findUnique({ where: { requestId: input.requestId }, select: { userId: true } });
    if (!log || log.userId !== userId) return { ok: false, code: "NOT_FOUND" };
    const dup = await db.inquiry.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } } });
    if (dup) return { ok: false, code: "DUPLICATE" };
  }
  try {
    const row = await db.inquiry.create({
      data: { userId, requestId: input.requestId ?? null, category: input.category, body: input.body },
    });
    return { ok: true, id: row.id };
  } catch (e) {
    // 동시에 두 번 보낸 경우 (유니크 키)
    if ((e as { code?: string }).code === "P2002") return { ok: false, code: "DUPLICATE" };
    throw e;
  }
}

/** 문의 화면에 보여 줄 내 생성 건 요약. 이미지 보관 여부는 "확인 가능한지"만 알린다 (보관 폴더·판정값은 알리지 않는다) */
export async function inquiryTarget(userId: string, requestId: string) {
  const log = await db.generationLog.findUnique({
    where: { requestId },
    select: { userId: true, createdAt: true, outcome: true, blockCode: true, requestText: true, imageStoredAt: true, imageExpiresAt: true },
  });
  if (!log || log.userId !== userId) return null;
  const imageAvailable = !!log.imageStoredAt && !!log.imageExpiresAt && log.imageExpiresAt > new Date();
  return {
    createdAt: log.createdAt,
    outcome: log.outcome,
    blockCode: log.blockCode,
    requestText: log.requestText,
    imageAvailable,
  };
}
