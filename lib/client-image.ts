/**
 * 업로드 전 브라우저에서 이미지 줄이기 (Workers에는 sharp가 없으므로 서버는 검증만 한다).
 * - EXIF 방향을 적용한 뒤 긴 변을 maxSide 이하로 줄이고 JPEG로 다시 만든다.
 * - 캔버스로 다시 그리면 EXIF(위치 정보 등) 메타데이터는 남지 않는다. 서버에서도 한 번 더 제거한다.
 * - 투명 배경(PNG)은 흰색으로 채운다.
 */
export class ImageReadError extends Error {}

export async function resizeForUpload(file: File, maxSide: number, quality = 0.85): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageReadError("decode failed");
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageReadError("no canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new ImageReadError("encode failed");
    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
