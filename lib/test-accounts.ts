import "server-only";

/**
 * 테스트 계정 (운영자 본인 확인용). 이메일은 코드·저장소에 두지 않고 TEST_ACCOUNTS 환경 변수에만 둔다.
 * - 크레딧 예약·차감 없음, 사용자별 속도 제한·동시 요청 제한·하루 상한 없음
 * - 안전 검사: 개발 환경에서만 shadow (운영에서는 다른 사용자와 같은 규칙)
 *   shadow에서도 미성년자 의심·성적 이미지·노골적 요청·시스템 오류는 항상 차단된다.
 */
export function isTestAccount(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.TEST_ACCOUNTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export const testSafetyShadowAllowed = () => process.env.NODE_ENV !== "production";
