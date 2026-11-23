import ads from "@/config/ads.json";

/** 애드센스 판매자 확인 파일. config/ads.json의 client가 있을 때만 */
export function GET() {
  const pub = ads.client.replace(/^ca-/, "");
  if (!/^pub-\d+$/.test(pub)) return new Response("Not Found", { status: 404 });
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
