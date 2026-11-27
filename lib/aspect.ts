/** 이미지 크기에 가장 가까운 화면 비율 ("16:9" 같은 보기 중에서). 비율 차이는 로그로 비교 (2:1과 1:2를 같은 거리로) */
export function nearestRatio(width: number, height: number, ratios: string[]): string {
  if (!(width > 0 && height > 0) || !ratios.length) return "";
  const target = Math.log(width / height);
  let best = "";
  let bestDiff = Infinity;
  for (const r of ratios) {
    const [a, b] = r.split(":").map(Number);
    if (!(a > 0 && b > 0)) continue;
    const diff = Math.abs(Math.log(a / b) - target);
    if (diff < bestDiff) {
      best = r;
      bestDiff = diff;
    }
  }
  return best;
}
