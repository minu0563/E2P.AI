import "server-only";
import { createHash } from "node:crypto";

/**
 * 업로드 이미지 검증 (서버). Workers 런타임에서도 동작하도록 디코딩·네이티브 모듈 없이 바이트만 본다.
 * - 리사이즈·재인코딩은 브라우저가 한다(lib/client-image.ts). 서버는 형식·크기·해상도만 확인한다.
 * - JPEG만 받는다(브라우저가 항상 JPEG로 보낸다). 헤더에서 크기를 읽어 디코딩 없이 해상도를 막는다.
 * - 클라이언트를 우회한 요청에 대비해 EXIF·XMP·주석 등 메타데이터 구간(APP1~APP15, COM)을 지운다.
 * - 원본은 메모리에서만 다루고 저장하지 않는다.
 */
export class ImageError extends Error {}

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** JPEG 구간을 훑으며 크기를 읽고 메타데이터 구간을 뺀 바이트를 돌려준다. 형식이 깨졌으면 ImageError */
export function parseJpeg(input: Uint8Array) {
  const bad = () => new ImageError("이미지 파일이 올바르지 않습니다.");
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw bad();
  const out: Uint8Array[] = [input.subarray(0, 2)];
  let width = 0;
  let height = 0;
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) throw bad();
    // 채움 바이트(FF FF ...) 건너뛰기
    let m = i + 1;
    while (m < input.length && input[m] === 0xff) m++;
    if (m >= input.length) throw bad();
    const marker = input[m];
    const start = m - 1;
    if (marker === 0xd9) {
      out.push(input.subarray(start, m + 1)); // EOI
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(input.subarray(start, m + 1)); // 길이 없는 마커
      i = m + 1;
      continue;
    }
    if (m + 2 >= input.length) throw bad();
    const len = (input[m + 1] << 8) | input[m + 2];
    const end = m + 1 + len;
    if (len < 2 || end > input.length) throw bad();
    if (SOF.has(marker)) {
      if (len < 7) throw bad();
      height = (input[m + 4] << 8) | input[m + 5];
      width = (input[m + 6] << 8) | input[m + 7];
    }
    if (marker === 0xda) {
      // 스캔 시작: 이후는 압축 데이터. 이미지 끝(EOI, FF D9)까지만 남기고 그 뒤에 덧붙은 바이트(숨긴 파일·메타데이터)는 버린다.
      // 압축 데이터 안의 FF는 FF 00으로 바뀌어 있으므로 FF D9는 이미지 끝에서만 나온다
      let eoi = -1;
      for (let k = end; k + 1 < input.length; k++) {
        if (input[k] === 0xff && input[k + 1] === 0xd9) {
          eoi = k;
          break;
        }
      }
      out.push(eoi >= 0 ? input.subarray(start, eoi + 2) : input.subarray(start));
      i = input.length;
      break;
    }
    const metadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!metadata) out.push(input.subarray(start, end));
    i = end;
  }
  if (!width || !height) throw bad();
  const total = out.reduce((n, p) => n + p.length, 0);
  const stripped = new Uint8Array(total);
  let o = 0;
  for (const p of out) {
    stripped.set(p, o);
    o += p.length;
  }
  return { width, height, stripped };
}

export async function validateImage(input: Uint8Array, maxSide: number, maxBytes: number) {
  if (input.length > maxBytes) throw new ImageError("이미지 파일이 너무 큽니다.");
  const { width, height, stripped } = parseJpeg(input);
  // 브라우저가 maxSide로 줄여 보내므로 넘으면 우회한 요청이다 (반올림 여유 1px)
  if (Math.max(width, height) > maxSide + 1) throw new ImageError("이미지 해상도가 너무 큽니다.");
  return {
    base64: Buffer.from(stripped).toString("base64"),
    hash: createHash("sha256").update(stripped).digest("hex"),
    width,
    height,
  };
}
