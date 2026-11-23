import { timingSafeEqual } from "node:crypto";
import { purgeExpired } from "@/lib/retention";

/**
 * 정리 작업 (매일). Cloudflare Cron이 worker.mjs의 scheduled()에서 이 경로를 내부 호출한다.
 * 비밀 값(CRON_SECRET, Workers Secret)이 맞을 때만 실행. 없거나 틀리면 404 (경로가 있다는 것도 알리지 않음).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("x-cron-secret") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response(null, { status: 404 });
  }
  const result = await purgeExpired();
  console.log("[cron] cleanup", JSON.stringify(result));
  return Response.json({ ok: true, ...result });
}
