/**
 * 메인 화면 "이미지 → 프롬프트 → 영상" 쇼케이스.
 * 이미지·영상 파일을 public/showcase/ 에 넣고 아래 경로를 채우면 자리 표시 대신 실제 파일이 나온다.
 * (예: image: "/showcase/1-image.jpg", video: "/showcase/1-video.mp4")
 * 실제 인물이 나오면 본인 또는 사용 동의를 받은 사진·영상만 쓴다.
 */
/** 메인 "지원 모델" 목록. 모델명은 설명 목적으로만 쓴다(제휴 아님). 지원 시작하면 live: true */
export const MODELS: { name: string; modes: ("i2v" | "t2i" | "i2i" | "t2v")[]; live: boolean; /** /guide/<slug> 모델별 가이드 (있으면) */ guide?: string }[] = [
  { name: "MiniMax H3", modes: ["i2v"], live: true, guide: "minimax-h3" },
  { name: "FLUX", modes: ["t2i", "i2i"], live: false },
  { name: "Krea", modes: ["t2i"], live: false },
  { name: "Qwen Image", modes: ["t2i", "i2i"], live: false },
];

export type ShowcaseItem = {
  image: string | null;
  video: string | null;
  /** 사용자가 적은 한 줄 (언어별) */
  request: { ko: string; en: string };
  /** E2P가 만든 프롬프트 (영어) */
  prompt: string;
};

export const SHOWCASE: ShowcaseItem[] = [
  {
    image: null,
    video: null,
    request: { ko: "해변을 천천히 달린다", en: "Runs slowly along the beach" },
    prompt: `[Core idea] 8s, 9:16. One continuous take, no cuts. Subject: the person from @image1 in a white linen shirt. Location: a sandy beach at sunset.
[Scene-by-scene]
0–3s: She takes a breath and starts jogging along the wet sand, arms swinging loosely.
3–8s: She slows to a stop, turns her head back over her shoulder and smiles.
Audio: waves, light wind. No dialogue.`,
  },
];
