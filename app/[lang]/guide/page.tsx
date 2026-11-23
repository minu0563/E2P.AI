import { AdSlot } from "@/components/ad-slot";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/guide", {
    ko: { title: "이미지→영상 프롬프트 가이드", description: "이미지→영상(i2v) 모델에 넣을 프롬프트를 쓰는 방법과 예시. E2P.AI 가이드." },
    en: { title: "Image-to-video prompt guide", description: "How to write prompts for image-to-video (i2v) models, with examples. The E2P.AI guide." },
  });
}

const EXAMPLES = [
  {
    ko: { title: "비 오는 거리", req: "앞으로 걸어간다, 카메라가 따라간다" },
    en: { title: "Rainy street", req: "Walks forward, camera follows" },
    prompt:
      "A rainy city street at night with neon reflections on the wet asphalt. A man in a dark coat holding an umbrella. He starts walking steadily toward the camera. Camera: slow tracking shot moving backward in front of him. Lighting: cool blue neon with warm shop lights.",
  },
  {
    ko: { title: "자동차 질주", req: "차가 빠르게 달려 나간다" },
    en: { title: "Speeding car", req: "The car speeds off" },
    prompt:
      "A winding mountain road under a clear sky. A glossy red sports car. The car accelerates and speeds around the curve, dust lifting from the road edge. Camera: low angle, panning to follow the car. Lighting: bright midday sun.",
  },
];

// TODO(사용자): 공식 가이드를 본인 표현으로 재작성한 내용으로 보강. 원문 복사 금지.
export default async function GuidePage() {
  const ko = (await getLocale()) === "ko";
  return (
    <DocPage
      title={ko ? "이미지→영상 프롬프트 가이드" : "Image-to-video prompt guide"}
      lead={
        ko
          ? "올린 이미지가 영상의 첫 장면이 됩니다. 그래서 이미 있는 것을 길게 설명하기보다, 앞으로 무엇이 어떻게 움직이는지를 분명히 쓰는 것이 중요합니다."
          : "Your image becomes the first frame. Rather than describing what is already there, say clearly what moves and how."
      }
    >
      {ko ? (
        <>
          <h2>1. 무엇이 움직이는지부터</h2>
          <ul>
            <li>동작은 구체적인 동사와 방향·속도로 씁니다. ‘움직인다’보다 ‘카메라 쪽으로 천천히 걸어온다’.</li>
            <li>여러 동작이면 순서를 분명히(먼저 ~하고, 그다음 ~). E2P는 이를 시간대별로 나눠 줍니다.</li>
            <li>이미지 속 정지된 자세에 끌려가지 않도록, 원하는 움직임을 분명히 적습니다.</li>
          </ul>
          <h2>2. 카메라는 따로</h2>
          <ul>
            <li>고정(static), 천천히 다가가기(push-in), 멀어지기(pull-back)</li>
            <li>좌우 돌리기(pan), 위아래(tilt), 따라가기(tracking), 주위를 돌기(orbit)</li>
            <li>비워 두면 원본 구도를 유지합니다.</li>
          </ul>
          <h2>3. 이미지와 어긋나지 않게</h2>
          <ul>
            <li>복장·배경·조명은 이미지와 맞춥니다. 이미지에 없는 사람이나 물건을 갑자기 넣지 않습니다.</li>
            <li>품질 태그를 길게 나열하기보다 평이한 문장이 낫습니다.</li>
          </ul>
          <h2>4. 진행 속도</h2>
          <p>‘빠름’은 첫 동작을 앞 20% 안에 끝내고 동작을 더 넣고, ‘천천히’는 동작 수를 줄여 부드럽게 움직입니다.</p>
        </>
      ) : (
        <>
          <h2>1. Start with what moves</h2>
          <ul>
            <li>Use concrete verbs with direction and speed: “walks slowly toward the camera” rather than “moves”.</li>
            <li>For several actions, make the order clear. E2P splits them into timed segments.</li>
            <li>State the motion you want so the model isn’t pulled back to the still pose in the image.</li>
          </ul>
          <h2>2. Keep the camera separate</h2>
          <ul>
            <li>Static, push-in, pull-back</li>
            <li>Pan, tilt, tracking, orbit</li>
            <li>Leave it empty to keep the original framing.</li>
          </ul>
          <h2>3. Stay consistent with the image</h2>
          <ul>
            <li>Match outfit, background and lighting to the image. Don’t introduce people or objects that aren’t there.</li>
            <li>Plain sentences beat long lists of quality tags.</li>
          </ul>
          <h2>4. Pacing</h2>
          <p>‘Fast’ finishes the first action within the first 20% and adds more actions; ‘Slow’ uses fewer, gentler motions.</p>
        </>
      )}

      <h2>{ko ? "예시" : "Examples"}</h2>
      {EXAMPLES.map((e) => {
        const l = ko ? e.ko : e.en;
        return (
          <div key={e.prompt}>
            <h3>{l.title}</h3>
            <p>
              {ko ? "요청" : "Request"}: {l.req}
            </p>
            <pre>{e.prompt}</pre>
          </div>
        );
      })}

      <AdSlot placement="guide" />

      <p className="mt-8">
        <Link href="/generate">{ko ? "생성기에서 직접 만들어 보기 →" : "Try it in the generator →"}</Link>
      </p>
      <p className="mt-6 text-xs">
        {ko
          ? "자체적으로 정리한 작성 팁이며, 모델 이름은 설명 목적으로만 사용합니다. 해당 모델 제공사와 관련이 없습니다."
          : "These are our own writing tips. Model names are used descriptively; we are not affiliated with their providers."}
      </p>
    </DocPage>
  );
}
