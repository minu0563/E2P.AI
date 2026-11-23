/**
 * 보관 이미지 암호화 (AES-256-GCM, WebCrypto — Workers·Node 공통).
 * - 키는 하나(IMAGE_KEY, base64 32바이트)이고 이미지마다 무작위 IV(12바이트)를 새로 만든다. IV는 비밀이 아니라 파일 앞에 함께 저장한다.
 * - 요청 ID를 추가 인증 데이터(AAD)로 묶어, 다른 건의 파일로 바꿔치기하면 복호화가 실패한다.
 * - 형식: "E2PI"(4) | 키 버전(1) | IV(12) | 암호문+인증 태그
 * 키를 바꿀 때는 버전을 올리고 옛 키를 남겨 두면 옛 파일도 열린다 (보관 기간이 짧아 30일 뒤엔 옛 키를 지워도 된다).
 */
// 비공개(시스템 프롬프트·규칙·키워드·키 처리): 브라우저 번들에 들어가면 빌드가 실패하게 한다
import "server-only";
const MAGIC = new TextEncoder().encode("E2PI");
const HEADER = MAGIC.length + 1 + 12;

export class ImageCryptoError extends Error {}

export type ImageKeys = { current: number; keys: Record<number, string> };

async function importKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new ImageCryptoError("IMAGE_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const aad = (requestId: string) => new TextEncoder().encode(`e2p-image:${requestId}`);

export async function encryptImage(plain: Uint8Array, requestId: string, keys: ImageKeys): Promise<Uint8Array> {
  const b64 = keys.keys[keys.current];
  if (!b64) throw new ImageCryptoError("current image key missing");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey(b64);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(requestId) }, key, plain as BufferSource),
  );
  const out = new Uint8Array(HEADER + ct.length);
  out.set(MAGIC, 0);
  out[MAGIC.length] = keys.current;
  out.set(iv, MAGIC.length + 1);
  out.set(ct, HEADER);
  return out;
}

export async function decryptImage(blob: Uint8Array, requestId: string, keys: ImageKeys): Promise<Uint8Array> {
  if (blob.length <= HEADER || MAGIC.some((b, i) => blob[i] !== b)) throw new ImageCryptoError("not an encrypted image");
  const version = blob[MAGIC.length];
  const b64 = keys.keys[version];
  if (!b64) throw new ImageCryptoError(`image key v${version} missing`);
  const iv = blob.slice(MAGIC.length + 1, HEADER);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad(requestId) },
      await importKey(b64),
      blob.slice(HEADER),
    );
    return new Uint8Array(plain);
  } catch {
    // 키가 다르거나, 파일이 바뀌었거나, 다른 요청의 파일
    throw new ImageCryptoError("decrypt failed");
  }
}

/** 환경 변수에서 키 묶음: IMAGE_KEY = 버전 1. 나중에 IMAGE_KEY_V2를 넣고 IMAGE_KEY_VERSION=2로 바꾸면 새 키로 저장 */
export function keysFromEnv(get: (name: string) => string | undefined): ImageKeys | null {
  const keys: Record<number, string> = {};
  const v1 = get("IMAGE_KEY");
  if (v1) keys[1] = v1;
  for (let v = 2; v <= 9; v++) {
    const k = get(`IMAGE_KEY_V${v}`);
    if (k) keys[v] = k;
  }
  const current = Number(get("IMAGE_KEY_VERSION") ?? 1);
  return keys[current] ? { current, keys } : null;
}
