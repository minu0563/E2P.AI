import "server-only";
import { getRedis } from "@/lib/redis";

/** 고정 창 카운터. 창 안에서 max번까지 허용. 서버에서만. */
export async function hit(key: string, max: number, windowSec: number) {
  const r = getRedis();
  const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const n = await r.incr(k);
  if (n === 1) await r.expire(k, windowSec + 1);
  return n <= max;
}

/**
 * 요청 IP. 운영에서는 신뢰할 수 있는 프록시(로드밸런서 등) 뒤에 두고
 * 그 프록시가 설정한 x-forwarded-for 첫 값만 믿는다.
 */
export function clientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
