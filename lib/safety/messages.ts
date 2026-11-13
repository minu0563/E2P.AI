export type BlockCode =
  | "AGE_UNCERTAIN"
  | "SEXUAL_IMAGE"
  | "SEXUAL_REQUEST"
  | "THIRD_PARTY_CLAIM"
  | "MODE_RESTRICTED"
  | "OUTPUT_FILTER"
  | "SYSTEM_ERROR"
  | "INVALID_INPUT"
  | "LOGIN_REQUIRED"
  | "NO_CREDITS"
  | "DAILY_LIMIT";

/** 사용자에게는 카테고리 수준만. 키워드·라벨·점수는 노출하지 않는다. */
export const BLOCK_MESSAGES: Record<BlockCode, string> = {
  AGE_UNCERTAIN: "연령을 확인할 수 없는 인물이 포함된 이미지는 처리할 수 없습니다.",
  SEXUAL_IMAGE: "이 이미지는 서비스 정책상 처리할 수 없습니다.",
  SEXUAL_REQUEST: "요청 내용이 서비스 정책에 맞지 않아 처리할 수 없습니다.",
  THIRD_PARTY_CLAIM: "본인 또는 사용 동의를 받은 인물의 사진만 사용할 수 있습니다.",
  MODE_RESTRICTED: "이 이미지로는 해당 기능을 사용할 수 없습니다.",
  OUTPUT_FILTER: "생성 결과가 정책에 맞지 않아 제공할 수 없습니다. 요청을 수정해 다시 시도해 주세요.",
  SYSTEM_ERROR: "이미지를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  INVALID_INPUT: "입력을 확인해 주세요.",
  LOGIN_REQUIRED: "로그인 후 이용할 수 있습니다.",
  NO_CREDITS: "크레딧이 부족합니다.",
  DAILY_LIMIT: "오늘 이용 한도에 도달했습니다. 내일 다시 이용해 주세요.",
};

export const NEUTRALIZED_NOTICE = "일부 표현이 조정되었습니다.";
