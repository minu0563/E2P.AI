import "server-only";
import appConfig from "@/config/app.json";
import { releaseStaleReservations } from "@/lib/credits";
import { db } from "@/lib/db";
import { cleanupExpiredLimits } from "@/lib/limits";

/**
 * 보관 기간이 지난 기록 파기 (사람 검토 영역 — 개인정보 파기). 매일 한 번 정리 작업이 부른다(/api/cron/cleanup).
 * - 생성 기록·문의: 생성일로부터 record_days 지나면 삭제 (탈퇴 여부와 무관, 탈퇴로 앞당기지 않음)
 * - 크레딧 내역: 지급분이 record_days 전에 만들어졌고 이미 만료된 것만, 그 지급분에 딸린 줄을 통째로 삭제 (잔액 계산이 깨지지 않게)
 * - 탈퇴 계정: 탈퇴 후 withdrawn_days 지나면 남은 기록과 함께 행 삭제
 * - 관리자 작업 기록·이미지 열람 세션: admin_log_days 지나면 삭제
 * - 수사기관 보존(hold) 이미지가 걸린 생성 기록과 그 사용자는 지우지 않는다
 * - 한 번에 batch줄까지만 (Workers 시간 제한). 남으면 다음 날 이어서
 */
const R = appConfig.retention;
const DAY = 86_400_000;

export type PurgeResult = {
  logs: number;
  inquiries: number;
  creditEntries: number;
  users: number;
  adminLogs: number;
  viewSessions: number;
  staleReservations: number;
};

export async function purgeExpired(now = new Date()): Promise<PurgeResult> {
  const recordCutoff = new Date(now.getTime() - R.record_days * DAY);
  const withdrawnCutoff = new Date(now.getTime() - R.withdrawn_days * DAY);
  const adminCutoff = new Date(now.getTime() - R.admin_log_days * DAY);

  // 생성 기록 (hold 제외)
  const oldLogs = await db.generationLog.findMany({
    where: { createdAt: { lt: recordCutoff }, OR: [{ imageTier: null }, { imageTier: { not: "hold" } }] },
    select: { id: true },
    take: R.batch,
  });
  const logs = (await db.generationLog.deleteMany({ where: { id: { in: oldLogs.map((l) => l.id) } } })).count;

  const oldInquiries = await db.inquiry.findMany({ where: { createdAt: { lt: recordCutoff } }, select: { id: true }, take: R.batch });
  const inquiries = (await db.inquiry.deleteMany({ where: { id: { in: oldInquiries.map((q) => q.id) } } })).count;

  // 크레딧 내역: 오래되고 이미 만료된 지급분과 거기 딸린 줄 (유효기간 없는 지급분은 건드리지 않음)
  const creditEntries = await db.$executeRaw`
    DELETE FROM "CreditEntry" WHERE "grantId" IN (
      SELECT "id" FROM "CreditEntry"
      WHERE kind = 'grant' AND "createdAt" < ${recordCutoff} AND "expiresAt" IS NOT NULL AND "expiresAt" < ${now}
      LIMIT ${R.batch}
    )`;

  // 탈퇴 계정 (hold 기록이 있으면 남긴다)
  const gone = await db.user.findMany({
    where: { withdrawnAt: { lt: withdrawnCutoff }, logs: { none: { imageTier: "hold" } } },
    select: { id: true },
    take: 50,
  });
  let users = 0;
  for (const { id } of gone) {
    await db.$transaction([
      db.creditEntry.deleteMany({ where: { userId: id } }),
      db.inquiry.deleteMany({ where: { userId: id } }),
      db.generationLog.deleteMany({ where: { userId: id } }),
      db.user.delete({ where: { id } }), // 세션·동의 기록은 함께 삭제(Cascade)
    ]);
    users++;
  }

  const adminLogs = (await db.adminLog.deleteMany({ where: { createdAt: { lt: adminCutoff } } })).count;
  const viewSessions = (await db.imageViewSession.deleteMany({ where: { createdAt: { lt: adminCutoff } } })).count;

  // 짧은 주기 정리도 함께 (요청이 없던 날에도 돌도록)
  const staleReservations = await releaseStaleReservations(undefined, now);
  await cleanupExpiredLimits();

  return { logs, inquiries, creditEntries, users, adminLogs, viewSessions, staleReservations };
}
