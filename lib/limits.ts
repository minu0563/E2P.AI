import "server-only";
import appConfig from "@/config/app.json";
import { db } from "@/lib/db";

/**
 * 속도 제한·동시 요청 제한 (Postgres). Workers에는 상시 Redis가 없으므로 DB의 원자적 쿼리로 처리한다.
 * - 모든 판정은 한 문장의 쿼리(INSERT … ON CONFLICT … RETURNING)라 동시에 와도 정확하다.
 * - 운영에서는 Cloudflare WAF 속도 제한·봇 방지가 앞단에서 먼저 거른다(이건 계정 단위 제어용).
 * - 플랫폼 기능(Rate Limiting 바인딩·KV 등)으로 바꿀 때는 이 파일만 고친다.
 */
export const RATE_CONFIG = appConfig.rate_limit;
export const GENERATION_CONFIG = appConfig.generation;

/** 고정 창 카운터: 창(windowSec) 안에서 max번까지 허용 */
export async function hit(key: string, max: number, windowSec: number) {
  const window = Math.floor(Date.now() / 1000 / windowSec);
  const k = `${key}:${window}`;
  const expiresAt = new Date((window + 1) * windowSec * 1000 + 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${k}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;
  return Number(rows[0]?.count ?? Infinity) <= max;
}

/**
 * 사용자당 동시 1건. 자리를 잡으면 true.
 * 이미 진행 중이면 false. 만료된 자리(요청이 비정상 종료된 경우)는 새 요청이 가져간다.
 */
export async function claimSlot(userId: string, requestId: string) {
  const expiresAt = new Date(Date.now() + GENERATION_CONFIG.slot_ttl_seconds * 1000);
  const rows = await db.$queryRaw<{ requestId: string }[]>`
    INSERT INTO "ActiveGeneration" ("userId", "requestId", "expiresAt") VALUES (${userId}, ${requestId}, ${expiresAt})
    ON CONFLICT ("userId") DO UPDATE
      SET "requestId" = EXCLUDED."requestId", "expiresAt" = EXCLUDED."expiresAt", "createdAt" = now()
      WHERE "ActiveGeneration"."expiresAt" < now()
    RETURNING "requestId"`;
  return rows[0]?.requestId === requestId;
}

/** 그 요청이 잡은 자리일 때만 푼다 */
export async function releaseSlot(userId: string, requestId: string) {
  await db.activeGeneration.deleteMany({ where: { userId, requestId } });
}

/** 지금 진행 중인 생성 수 (전체 동시 처리 상한·관리자 화면용) */
export function activeCount() {
  return db.activeGeneration.count({ where: { expiresAt: { gt: new Date() } } });
}

/**
 * 요청 IP. Cloudflare 뒤에서는 엣지가 넣는 CF-Connecting-IP만 믿는다(사용자가 덮어쓸 수 없다).
 * x-forwarded-for는 위조할 수 있으므로 쓰지 않는다. 로컬 개발에서는 모두 "local".
 */
export function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip")?.trim() || "local";
}

/** 만료된 제한 기록 정리 (예약 정리와 함께 주기적으로) */
export async function cleanupExpiredLimits() {
  const now = new Date();
  await db.$transaction([
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.activeGeneration.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.blockedImage.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
}
