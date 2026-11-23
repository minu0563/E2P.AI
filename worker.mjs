// Cloudflare Worker 진입점: OpenNext가 만든 앱(.open-next/worker.js)에 정리 작업(Cron)을 붙인다.
// 정리 작업은 앱 안의 /api/cron/cleanup을 내부 호출한다 (DB·설정 코드를 한 곳에 두기 위해). 비밀 값 CRON_SECRET 필요.
import handler from "./.open-next/worker.js";

const worker = {
  fetch: handler.fetch,

  async scheduled(controller, env, ctx) {
    if (!env.CRON_SECRET) {
      console.warn("[cron] CRON_SECRET not set; skipping cleanup");
      return;
    }
    const origin = env.APP_URL || "https://cron.internal";
    const res = await handler.fetch(
      new Request(`${origin}/api/cron/cleanup`, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET } }),
      env,
      ctx,
    );
    console.log("[cron] cleanup", controller.cron, res.status, await res.text());
  },
};

export default worker;
