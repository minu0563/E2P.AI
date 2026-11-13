import "server-only";
import IORedis from "ioredis";

/**
 * Redis 연결 (큐·속도 제한·우회 루프 차단 기록).
 * 운영에서는 외부 포트를 열지 않고 비밀번호를 건 주소를 REDIS_URL에 둔다.
 */
const g = globalThis as unknown as { redis?: IORedis };

export function getRedis(): IORedis {
  if (!g.redis) {
    // BullMQ 워커는 maxRetriesPerRequest: null 이 필요하다
    g.redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
  }
  return g.redis;
}
