// 배포 전 Worker 코드 크기 검사 (CLAUDE-cloudflare.md 2장 5번).
// 압축 기준 한도: 무료 3MiB, 유료 10MiB. 유료 한도 90%를 넘으면 실패, 무료 한도를 넘으면 경고.
import { execFileSync } from "node:child_process";

const env = process.argv[2];
const args = ["wrangler", "deploy", "--dry-run", "--outdir", ".wrangler-dry", ...(env ? ["--env", env] : [])];
const out = execFileSync("npx", args, { encoding: "utf8", shell: process.platform === "win32" });
const m = out.match(/gzip:\s*([\d.]+)\s*KiB/);
if (!m) {
  console.error(out);
  throw new Error("could not read gzip size from wrangler output");
}
const kib = Number(m[1]);
const FREE = 3 * 1024;
const PAID = 10 * 1024;
console.log(`Worker bundle (gzip): ${kib.toFixed(0)} KiB  (free limit ${FREE}, paid limit ${PAID})`);
if (kib > PAID * 0.9) {
  console.error("❌ 유료 한도의 90%를 넘었습니다. 무거운 의존성을 줄이세요.");
  process.exit(1);
}
if (kib > FREE) console.warn("⚠️ 무료 플랜 한도(3MiB)를 넘습니다. Workers Paid가 필요합니다.");
