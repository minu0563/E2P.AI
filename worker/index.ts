/**
 * 생성 워커: 큐(Redis)에서 작업을 꺼내 파이프라인을 돌린다.
 * 실행: npm run worker  (웹과 같이: npm run dev:all)
 */
import { Worker } from "bullmq";
import { QUEUE_CONFIG, QUEUE_NAME, type GenerateJobData } from "@/lib/queue";
import { processGenerateJob, type JobResult } from "@/lib/queue/process";
import { getRedis } from "@/lib/redis";
import { releaseStaleReservations } from "@/lib/credits";

const worker = new Worker<GenerateJobData, JobResult>(QUEUE_NAME, processGenerateJob, {
  connection: getRedis(),
  concurrency: QUEUE_CONFIG.worker_concurrency,
  // 파이프라인이 오래 걸려도 작업을 다른 워커에 다시 넘기지 않게 넉넉히
  lockDuration: 5 * 60_000,
});

worker.on("ready", () => console.log(`[worker] ready (concurrency ${QUEUE_CONFIG.worker_concurrency})`));
worker.on("failed", (job, err) => console.error("[worker] failed", job?.id, String(err).slice(0, 200)));

// 1분마다 오래된 크레딧 예약 정리 (워커가 죽었던 경우 등)
const sweep = setInterval(() => {
  releaseStaleReservations().catch((e) => console.error("[worker] stale sweep failed", String(e).slice(0, 200)));
}, 60_000);

async function shutdown() {
  clearInterval(sweep);
  await worker.close(); // 처리 중인 작업은 끝내고 닫는다
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
