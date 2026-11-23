import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("업로드 이미지 서버 검증 (sharp 없이)", async () => {
  const { validateImage, parseJpeg, ImageError } = await import("@/lib/image");
  const jpeg = (w: number, h: number, withExif = false) => {
    let s = sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 80, b: 40 } } }).jpeg();
    if (withExif) s = s.withMetadata({ exif: { IFD0: { Copyright: "SECRET-GPS-TEST", Artist: "someone" } } });
    return s.toBuffer().then((b) => new Uint8Array(b));
  };

  it("JPEG 크기를 헤더에서 읽는다", async () => {
    const r = await validateImage(await jpeg(800, 600), 1024, 3_000_000);
    expect([r.width, r.height]).toEqual([800, 600]);
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("EXIF 메타데이터를 지우고, 지운 뒤에도 정상 이미지다", async () => {
    const src = await jpeg(400, 300, true);
    expect(Buffer.from(src).includes("SECRET-GPS-TEST")).toBe(true);
    const { stripped } = parseJpeg(src);
    expect(Buffer.from(stripped).includes("SECRET-GPS-TEST")).toBe(false);
    const meta = await sharp(Buffer.from(stripped)).metadata();
    expect([meta.width, meta.height, meta.exif]).toEqual([400, 300, undefined]);
  });

  it("이미지 끝(EOI) 뒤에 덧붙인 바이트는 버린다 (숨긴 파일·해시 바꾸기)", async () => {
    const src = await jpeg(200, 150);
    const tail = new TextEncoder().encode("PK\u0003\u0004HIDDEN-PAYLOAD");
    const padded = new Uint8Array(src.length + tail.length);
    padded.set(src);
    padded.set(tail, src.length);
    const a = await validateImage(src, 1024, 3_000_000);
    const b = await validateImage(padded, 1024, 3_000_000);
    expect(Buffer.from(b.base64, "base64").includes("HIDDEN-PAYLOAD")).toBe(false);
    expect(b.hash).toBe(a.hash);
    const meta = await sharp(Buffer.from(b.base64, "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([200, 150]);
  });

  it("긴 변이 한도를 넘으면 거부 (브라우저 우회)", async () => {
    await expect(validateImage(await jpeg(3000, 200), 1024, 3_000_000)).rejects.toBeInstanceOf(ImageError);
  });

  it("파일 크기 한도를 넘으면 거부", async () => {
    await expect(validateImage(await jpeg(800, 600), 1024, 100)).rejects.toBeInstanceOf(ImageError);
  });

  it("JPEG가 아니거나 깨진 파일은 거부", async () => {
    const png = new Uint8Array(await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer());
    await expect(validateImage(png, 1024, 3_000_000)).rejects.toBeInstanceOf(ImageError);
    const broken = (await jpeg(100, 100)).subarray(0, 30);
    await expect(validateImage(broken, 1024, 3_000_000)).rejects.toBeInstanceOf(ImageError);
    await expect(validateImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), 1024, 3_000_000)).rejects.toBeInstanceOf(ImageError);
  });
});
