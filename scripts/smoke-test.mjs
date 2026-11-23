// 배포 직후 스모크 테스트: node scripts/smoke-test.mjs https://e2pai.app
// 읽기 전용 요청만 보낸다 (로그인·생성 없음 → AI 비용·데이터 변화 없음).
// 처음 연결한 도메인은 인증서 발급에 몇 분 걸릴 수 있어 첫 요청은 기다리며 재시도한다.
const base = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https:\/\//.test(base)) throw new Error("usage: node scripts/smoke-test.mjs https://<domain>");
const host = new URL(base).host;

async function get(path) {
  return fetch(base + path, { redirect: "follow", headers: { "user-agent": "e2p-smoke-test" } });
}

async function waitUntilUp() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await get("/ko");
      if (res.status === 200) return;
      console.log(`waiting: /ko → ${res.status}`);
    } catch (e) {
      console.log(`waiting: ${e.cause?.code || e.message}`);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error("site did not come up within 5 minutes");
}

const checks = [
  ["/ko 200, 제목", async () => { const r = await get("/ko"); return r.status === 200 && (await r.text()).includes("E2P.AI"); }],
  ["/en 200", async () => (await get("/en")).status === 200],
  ["/ 200 (언어 협상)", async () => (await get("/")).status === 200],
  ["/guide/minimax-h3 200", async () => (await get("/ko/guide/minimax-h3")).status === 200],
  ["보안 헤더 (페이지)", async () => {
    const h = (await get("/ko")).headers;
    return h.get("x-content-type-options") === "nosniff" && !!h.get("strict-transport-security");
  }],
  ["보안 헤더 (정적 파일)", async () => (await get("/og.png")).headers.get("x-content-type-options") === "nosniff"],
  ["/_headers 비공개", async () => (await get("/_headers")).status === 404],
  ["robots.txt에 운영 사이트맵", async () => (await (await get("/robots.txt")).text()).includes(`https://${host}/sitemap.xml`)],
  ["sitemap.xml에 운영 주소", async () => { const r = await get("/sitemap.xml"); return r.status === 200 && (await r.text()).includes(`https://${host}/`); }],
  ["/admin 404 (비로그인)", async () => (await get("/admin")).status === 404],
  ["/api/history 401 (비로그인)", async () => (await get("/api/history")).status === 401],
];

await waitUntilUp();
let failed = 0;
for (const [name, run] of checks) {
  let ok = false;
  try {
    ok = await run();
  } catch (e) {
    console.log(`  error: ${e.message}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`${failed} check(s) failed. 롤백: npx wrangler rollback --env production`);
  process.exit(1);
}
console.log("all smoke checks passed");
