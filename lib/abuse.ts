import "server-only";
import appConfig from "@/config/app.json";
import { CREDIT_CONFIG } from "@/lib/credits";
import { db } from "@/lib/db";

/**
 * 연속 차단 단계 조치 (사람 검토 영역 — 계정 제한).
 * - 요청 내용 때문에 막힌 차단만 센다(크레딧 차단 수수료와 같은 사유). 이미지 판정 차단·시스템 오류는 세지 않는다(오판 부담을 사용자에게 지우지 않음).
 * - window_minutes 안에 warn_after번 → 경고, restrict_after번 → restrict_hours시간 생성 제한(로그인은 됨).
 * - 자동 정지는 하지 않는다. 제한이 반복된 계정은 관리자 대시보드 "정지 검토"에 보여 사람이 판단한다.
 * - 기록(GenerationLog)으로 세므로 기록을 남기지 않는 관리자 계정은 자연히 제외된다.
 */
export const ABUSE = appConfig.abuse;
export const COUNTED_CODES = CREDIT_CONFIG.block_fee.counted_codes;

export type AbuseNotice = "abuseWarn" | "abuseRestricted";

export function isRestricted(user: { restrictedUntil: Date | null }, now = new Date()) {
  return !!user.restrictedUntil && user.restrictedUntil > now;
}

/** 차단이 기록된 직후 호출. 셀 사유가 아니면 아무것도 하지 않는다 */
export async function recordBlock(userId: string, code: string, now = new Date()): Promise<AbuseNotice | null> {
  if (!COUNTED_CODES.includes(code)) return null;
  const since = new Date(now.getTime() - ABUSE.window_minutes * 60_000);
  const n = await db.generationLog.count({
    where: { userId, outcome: "block", blockCode: { in: COUNTED_CODES }, createdAt: { gte: since } },
  });
  if (n >= ABUSE.restrict_after) {
    const until = new Date(now.getTime() + ABUSE.restrict_hours * 3_600_000);
    // 이미 제한 중이면 늘리지 않는다 (제한 중에는 생성 자체가 막힌다)
    const r = await db.user.updateMany({
      where: { id: userId, OR: [{ restrictedUntil: null }, { restrictedUntil: { lte: now } }] },
      data: { restrictedUntil: until },
    });
    if (r.count) {
      await db.adminLog.create({
        data: {
          adminEmail: "system",
          action: "auto_restrict",
          targetUserId: userId,
          detail: { blocks: n, windowMinutes: ABUSE.window_minutes, until: until.toISOString() },
        },
      });
    }
    return "abuseRestricted";
  }
  return n >= ABUSE.warn_after ? "abuseWarn" : null;
}

/** 정지 검토 대상: 최근 review_window_days 안에 자동 제한이 review_after_restrictions번 이상, 아직 정지 안 된 계정 */
export async function reviewCandidates(now = new Date()) {
  const since = new Date(now.getTime() - ABUSE.review_window_days * 86_400_000);
  const groups = await db.adminLog.groupBy({
    by: ["targetUserId"],
    where: { action: "auto_restrict", createdAt: { gte: since }, targetUserId: { not: null } },
    _count: true,
    _max: { createdAt: true },
  });
  const hits = groups.filter((g) => g._count >= ABUSE.review_after_restrictions);
  if (!hits.length) return [];
  const users = await db.user.findMany({
    where: { id: { in: hits.map((g) => g.targetUserId!) }, suspendedAt: null },
    select: { id: true, email: true, restrictedUntil: true },
  });
  return users
    .map((u) => {
      const g = hits.find((h) => h.targetUserId === u.id)!;
      return { ...u, restrictions: g._count, lastAt: g._max.createdAt };
    })
    .sort((a, b) => b.restrictions - a.restrictions);
}
