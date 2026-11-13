import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * 큐에 잠시 올리는 이미지 암호화 (AES-256-GCM).
 * Redis 안을 들여다봐도 내용을 볼 수 없게 한다. 키는 QUEUE_SECRET(32바이트 hex).
 */
function key() {
  const hex = process.env.QUEUE_SECRET ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("QUEUE_SECRET must be 32 bytes hex");
  return Buffer.from(hex, "hex");
}

export function seal(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

export function open(sealed: Buffer): Buffer {
  const d = createDecipheriv("aes-256-gcm", key(), sealed.subarray(0, 12));
  d.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([d.update(sealed.subarray(28)), d.final()]);
}
