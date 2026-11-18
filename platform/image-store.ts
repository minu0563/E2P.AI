import "server-only";
import { decryptImage, encryptImage, keysFromEnv, type ImageKeys } from "@/lib/image-crypto";
import type { ImageTier } from "@/lib/image-retention";
import { workerRequest } from "./env";

/**
 * 보관 이미지 저장소 (Cloudflare R2, 바인딩 IMAGES). 플랫폼 의존 코드는 이 폴더에만 둔다.
 * - 항상 서비스 키로 암호화한 뒤 저장한다. 키·버킷이 없으면 **저장하지 않는다** (평문 저장 금지).
 * - 경로: <tier>/<requestId>. 삭제는 R2 수명 규칙이 폴더별로 한다 (hold/는 자동 삭제 없음).
 * - 로컬(next dev·테스트)에는 R2가 없어 저장하지 않는다.
 */
export type StoredTier = ImageTier | "hold";

type R2Object = { arrayBuffer(): Promise<ArrayBuffer> };
type R2Bucket = {
  put(key: string, value: Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string | string[]): Promise<void>;
};

function binding(): { bucket: R2Bucket; keys: ImageKeys } | null {
  const w = workerRequest();
  if (!w) return null;
  const bucket = w.env.IMAGES as R2Bucket | undefined;
  const keys = keysFromEnv((n) => {
    const v = w.env[n];
    return typeof v === "string" ? v : undefined;
  });
  if (!bucket || !keys) return null;
  return { bucket, keys };
}

export function imageStoreAvailable() {
  return binding() !== null;
}

const path = (tier: StoredTier, requestId: string) => `${tier}/${requestId}`;

/** 저장. 저장소가 없으면 false (호출 측은 실패로 기록만 하고 생성 결과에는 영향 없음) */
export async function putImage(tier: ImageTier, requestId: string, plain: Uint8Array): Promise<boolean> {
  const b = binding();
  if (!b) return false;
  const enc = await encryptImage(plain, requestId, b.keys);
  // 내용 유형을 일부러 이진 파일로 둔다 (대시보드에서 내려받아도 이미지로 열리지 않음)
  await b.bucket.put(path(tier, requestId), enc, { httpMetadata: { contentType: "application/octet-stream" } });
  return true;
}

/** 꺼내서 복호화. 없으면(만료·미저장) null */
export async function getImage(tier: StoredTier, requestId: string): Promise<Uint8Array | null> {
  const b = binding();
  if (!b) return null;
  const obj = await b.bucket.get(path(tier, requestId));
  if (!obj) return null;
  return decryptImage(new Uint8Array(await obj.arrayBuffer()), requestId, b.keys);
}

export async function deleteImage(tier: StoredTier, requestId: string) {
  const b = binding();
  if (!b) return;
  await b.bucket.delete(path(tier, requestId));
}

/**
 * 삭제 요청(탈퇴·당사자 요청)용: 요청 ID들의 이미지를 hold/를 뺀 모든 폴더에서 지운다
 * (기록된 폴더와 실제 위치가 어긋나도 남지 않게). 저장소가 없으면 false — 호출 측은 DB를 바꾸지 않는다
 */
export async function deleteImagesExceptHold(requestIds: string[]): Promise<boolean> {
  const b = binding();
  if (!b) return false;
  const tiers: StoredTier[] = ["recent", "blocked", "quarantine"];
  const keys = requestIds.flatMap((id) => tiers.map((t) => path(t, id)));
  for (let i = 0; i < keys.length; i += 900) await b.bucket.delete(keys.slice(i, i + 900)); // R2 한 번에 최대 1000개
  return true;
}

/** 다른 폴더로 옮기기 (예: 수사기관 보존 요청 → hold/). 같은 키로 암호화된 그대로 복사한 뒤 원본 삭제 */
export async function moveImage(from: StoredTier, to: StoredTier, requestId: string): Promise<boolean> {
  const b = binding();
  if (!b) return false;
  const obj = await b.bucket.get(path(from, requestId));
  if (!obj) return false;
  await b.bucket.put(path(to, requestId), new Uint8Array(await obj.arrayBuffer()), {
    httpMetadata: { contentType: "application/octet-stream" },
  });
  await b.bucket.delete(path(from, requestId));
  return true;
}

/** 응답이 끝난 뒤에도 작업을 마치게 한다 (Workers). Node에서는 그냥 실행 */
export function runAfterResponse(p: Promise<unknown>) {
  const w = workerRequest();
  if (w) w.waitUntil(p);
}
