import { timingSafeEqual } from "node:crypto";
import { purgeExpired } from "@/lib/retention";

/**
 * 정리 작업 (매일). Cloudflare Cron이 worker.mjs의 scheduled()에서 이 경로를 내부 호출한다.
 * 비밀 값(CRON_SECRET, Workers Secret)이 맞을 때만 실행. 없거나 틀리면 404 (경로가 있다는 것도 알리지 않음).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  // 바이트 길이로 비교 (글자 수가 같아도 바이트 수가 다르면 timingSafeEqual이 예외를 던져 500이 된다)
  const a = Buffer.from(request.headers.get("x-cron-secret") ?? "");
  const b = Buffer.from(secret ?? "");
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response(null, { status: 404 });
  }
  const result = await purgeExpired();
  console.log("[cron] cleanup", JSON.stringify(result));
  return Response.json({ ok: true, ...result });
}
