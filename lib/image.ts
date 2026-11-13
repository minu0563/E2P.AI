import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";

const ALLOWED = new Set(["jpeg", "png", "webp"]);

/**
 * 업로드 이미지를 메모리에서만 처리한다(디스크·로그에 남기지 않음).
 * 형식 검증 → 리사이즈(긴 변 maxSide) → JPEG 재인코딩(메타데이터 제거).
 */
export async function processImage(input: Buffer, maxSide: number) {
  // 압축 폭탄 방어: 디코딩 전에 헤더의 크기로 막고, 디코딩에도 같은 한도를 건다
  const MAX_PIXELS = 40_000_000;
  const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
  if (!meta.format || !ALLOWED.has(meta.format)) {
    throw new ImageError("지원하지 않는 이미지 형식입니다. (JPG, PNG, WEBP)");
  }
  if (!meta.width || !meta.height || meta.width * meta.height > MAX_PIXELS) {
    throw new ImageError("이미지 해상도가 너무 큽니다.");
  }
  const out = await sharp(input, { limitInputPixels: MAX_PIXELS, pages: 1 })
    .rotate() // EXIF 방향 적용 후 메타데이터는 버린다
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return {
    base64: out.toString("base64"),
    hash: createHash("sha256").update(out).digest("hex"),
    width: meta.width,
    height: meta.height,
  };
}

export class ImageError extends Error {}
