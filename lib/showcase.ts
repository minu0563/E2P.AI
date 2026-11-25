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
    // AI로 만든 예시 이미지(실존 인물 없음) → E2P 프롬프트 → MiniMax H3 결과 영상(소리 제거, 재인코딩)
    image: "/showcase/1-image.jpg",
    video: "/showcase/1-video.mp4",
    request: { ko: "이미지 속 차가 앞으로 달린다", en: "The car in the image drives forward" },
    prompt: `[Reference] @image1 is the scene reference and the first frame.
[Core idea] 4s, 9:16. One continuous take, no cuts. Subject: a black McLaren sports car with orange racing stripes. Location: a winding coastal road at sunset, overlooking the ocean. Event: the car drives forward along the curve toward the camera and passes by the camera's left side, exiting the frame. Style: Realistic live-action footage, no cinematic look. Lighting: warm sunset light with soft shadows. Camera: static.
[Scene-by-scene]
0–1s: the car accelerates along the curve, moving from the lower half of the frame toward the center, heading directly toward the camera lens. Sound: the roar of the engine grows rapidly louder and more intense.
1–3s: the car reaches its closest point to the lens, then steers slightly to the left, passing the camera's left side with high speed. Sound: a loud, high-pitched engine roar peaks as the car passes.
3–4s: the car quickly exits the frame on the left side, leaving the empty winding road and the sunset ocean in view. Sound: the engine sound rapidly fades into the distance.
Audio: a powerful engine roar that grows louder as the car approaches, peaks during the pass, and quickly fades as it exits. non_diegetic_music: N/A
Forbidden: watermark, subtitles, cluttered background.`,
  },
];
