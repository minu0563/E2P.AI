import "server-only";
import { Queue } from "bullmq";
import appConfig from "@/config/app.json";
import type { HistoryInput } from "@/lib/history";
import type { PipelineInput } from "@/lib/pipeline";
import { getRedis } from "@/lib/redis";
import { open, seal } from "./crypto";

/**
 * 생성 큐 (웹 → Redis → 워커).
 * - 작업 데이터에는 이미지를 넣지 않는다. 이미지는 암호화해 별도 키에 짧게 두고, 워커가 꺼내는 즉시 지운다.
 * - 사용자당 동시 1건: active:<userId> 키로 잡는다.
 */
export const QUEUE_NAME = process.env.QUEUE_NAME ?? "generate"; // 테스트는 별도 이름
export const QUEUE_CONFIG = appConfig.queue;
export const RATE_CONFIG = appConfig.rate_limit;

export type GenerateJobData = {
  requestId: string;
  userId: string;
  profileId: string;
  input: Omit<PipelineInput, "image" | "profile" | "requestId">;
  imageHash: string;
  savedInput: HistoryInput;
};

/** 진행 단계 (워커가 job.updateProgress로 알린다) */
export type JobStage = "analyzing" | "writing";

const g = globalThis as unknown as { generateQueue?: Queue<GenerateJobData> };

export function getQueue(): Queue<GenerateJobData> {
  if (!g.generateQueue) {
    g.generateQueue = new Queue<GenerateJobData>(QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 1, // 재시도는 파이프라인 안에서 1회로 제한(원가 묶기). 큐 단에서는 다시 돌리지 않는다
        removeOnComplete: { age: QUEUE_CONFIG.result_ttl_seconds },
        removeOnFail: { age: QUEUE_CONFIG.result_ttl_seconds },
      },
    });
  }
  return g.generateQueue;
}

const imgKey = (id: string) => `img:${id}`;
const cancelKey = (id: string) => `cancel:${id}`;
const activeKey = (userId: string) => `active:${userId}`;

/** 이미지를 암호화해 짧게 보관 (메모리 전용 Redis) */
export async function putImage(requestId: string, image: { base64: string; hash: string }) {
  const sealed = seal(Buffer.from(image.base64, "base64"));
  await getRedis().set(imgKey(requestId), sealed, "EX", QUEUE_CONFIG.image_ttl_seconds);
}

/** 꺼내면서 지운다. 없으면 null */
export async function takeImage(requestId: string, hash: string) {
  const sealed = await getRedis().getdelBuffer(imgKey(requestId));
  if (!sealed) return null;
  return { base64: open(sealed).toString("base64"), hash };
}

export const dropImage = (requestId: string) => getRedis().del(imgKey(requestId));

export const requestCancel = (requestId: string) =>
  getRedis().set(cancelKey(requestId), "1", "EX", QUEUE_CONFIG.result_ttl_seconds);
export const isCancelled = async (requestId: string) => (await getRedis().exists(cancelKey(requestId))) === 1;

/** 사용자당 동시 요청 자리 잡기. 이미 진행 중이면 false */
export async function claimSlot(userId: string, requestId: string) {
  const ttl = QUEUE_CONFIG.max_wait_seconds + 300; // 워커가 죽어도 결국 풀린다
  return (await getRedis().set(activeKey(userId), requestId, "EX", ttl, "NX")) === "OK";
}

/** 그 요청이 잡은 자리일 때만 푼다 */
export async function releaseSlot(userId: string, requestId: string) {
  const r = getRedis();
  if ((await r.get(activeKey(userId))) === requestId) await r.del(activeKey(userId));
}

/** 대기 순번 (1부터). 대기 중이 아니면 0 */
export async function queuePosition(requestId: string) {
  const waiting = await getQueue().getWaiting(0, QUEUE_CONFIG.max_waiting + 50);
  const ids = waiting.map((j) => j.id); // 먼저 들어온 순
  const i = ids.indexOf(requestId);
  return i < 0 ? 0 : i + 1;
}
