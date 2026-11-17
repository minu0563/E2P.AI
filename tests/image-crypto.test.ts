import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptImage, encryptImage, keysFromEnv } from "@/lib/image-crypto";

const k = () => randomBytes(32).toString("base64");
const keys = { current: 1, keys: { 1: k() } };
const img = new Uint8Array(randomBytes(5000));

describe("이미지 암호화", () => {
  it("암호화 → 복호화하면 원래와 같다", async () => {
    const enc = await encryptImage(img, "req-1", keys);
    expect(Buffer.from(enc).includes(Buffer.from(img.slice(0, 64)))).toBe(false);
    expect(await decryptImage(enc, "req-1", keys)).toEqual(img);
  });
  it("같은 이미지도 매번 다른 암호문 (이미지마다 다른 IV)", async () => {
    const a = await encryptImage(img, "req-1", keys);
    const b = await encryptImage(img, "req-1", keys);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
  it("다른 요청 ID로 열면(바꿔치기) 실패", async () => {
    const enc = await encryptImage(img, "req-1", keys);
    await expect(decryptImage(enc, "req-2", keys)).rejects.toThrow("decrypt failed");
  });
  it("한 바이트라도 바뀌면 실패", async () => {
    const enc = await encryptImage(img, "req-1", keys);
    enc[enc.length - 10] ^= 1;
    await expect(decryptImage(enc, "req-1", keys)).rejects.toThrow("decrypt failed");
  });
  it("다른 키로는 열 수 없다", async () => {
    const enc = await encryptImage(img, "req-1", keys);
    await expect(decryptImage(enc, "req-1", { current: 1, keys: { 1: k() } })).rejects.toThrow("decrypt failed");
  });
  it("키 교체: 새 버전으로 저장, 옛 파일도 열린다", async () => {
    const old = await encryptImage(img, "r", keys);
    const rotated = { current: 2, keys: { 1: keys.keys[1], 2: k() } };
    const fresh = await encryptImage(img, "r", rotated);
    expect(fresh[4]).toBe(2);
    expect(await decryptImage(old, "r", rotated)).toEqual(img);
    expect(await decryptImage(fresh, "r", rotated)).toEqual(img);
  });
  it("키 길이가 틀리면 거부, 키가 없으면 null", async () => {
    await expect(encryptImage(img, "r", { current: 1, keys: { 1: randomBytes(16).toString("base64") } })).rejects.toThrow("32 bytes");
    expect(keysFromEnv(() => undefined)).toBeNull();
    expect(keysFromEnv((n) => (n === "IMAGE_KEY" ? "x" : undefined))).toEqual({ current: 1, keys: { 1: "x" } });
  });
});
