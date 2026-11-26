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
    request: { ko: "차가 카메라를 스치듯이 움직인다", en: "The car moves past the camera, almost grazing it" },
    prompt: `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

integrated_multimodal_description: [Shot 1] 3D CG, a black sports car with orange stripes. A full-body shot with the car positioned in the lower center, moving along a curved road that leads the eye toward the horizon. A winding coastal road at sunset. Warm golden hour light from the sunset. The camera pushes in at fast speed. The black sports car with orange stripes accelerates along the curved road, its tires humming against the asphalt. Then, the car swerves slightly as it rounds a bend, passing extremely close to the lens with a sudden rush of air and sound. Finally, the car speeds away into the distance toward the horizon, leaving a faint trail of dust behind it.

overall_soundscape: The high-pitched roar of a powerful engine accelerating, the loud whoosh of air as the car passes the camera, and the rhythmic sound of tires on a paved road. Distant waves crash against the cliffs below.

non_diegetic_music: N/A`,
  },
];
