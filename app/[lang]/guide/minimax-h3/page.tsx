import { AdSlot } from "@/components/ad-slot";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd, localePath, pageMeta, siteUrl } from "@/lib/seo";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";

const PATH = "/guide/minimax-h3";
const META = {
  ko: {
    title: "MiniMax H3 프롬프트 가이드",
    description: "MiniMax H3 프롬프트 작성법과 예시.",
  },
  en: {
    title: "MiniMax H3 Prompt Guide",
    description: "How to write MiniMax H3 prompts, with examples.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta(PATH, META);
}

/** 검색 결과용: 이동 경로 + 글 정보 */
function guideJsonLd(locale: "ko" | "en") {
  const base = siteUrl();
  if (!base) return null;
  const m = META[locale];
  return [
    breadcrumbJsonLd(locale, [
      ["E2P.AI", "/"],
      [locale === "ko" ? "프롬프트 가이드" : "Prompt guides", "/guide"],
      ["MiniMax H3", PATH],
    ]),
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: m.title,
      description: m.description,
      inLanguage: locale,
      url: `${base}${localePath(locale, PATH)}`,
      about: { "@type": "SoftwareApplication", name: "MiniMax H3" },
      publisher: { "@type": "Organization", name: "E2P.AI", logo: { "@type": "ImageObject", url: `${base}/icon.png` } },
    },
  ];
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
export default async function MiniMaxH3GuidePage() {
  const locale = await getLocale();
  const ko = locale === "ko";
  return (
    <DocPage
      title={META[locale].title}
      lead={
        ko
          ? "MiniMax H3는 올린 사진을 첫 장면으로 삼아 움직임을 만듭니다. 그래서 이미 있는 것을 길게 설명하기보다, 앞으로 무엇이 어떻게 움직이는지를 분명히 쓰는 것이 중요합니다."
          : "MiniMax H3 uses your photo as the first frame and animates from there. Rather than describing what is already there, say clearly what moves and how."
      }
    >
      <JsonLd data={guideJsonLd(locale)} />
      <h2>{ko ? "E2P.AI로 MiniMax H3 프롬프트 만들기" : "Make a MiniMax H3 prompt with E2P.AI"}</h2>
      <ol>
        {ko ? (
          <>
            <li>사진을 올립니다. 장면·복장·조명·구도는 E2P.AI가 사진을 보고 채웁니다.</li>
            <li>원하는 움직임을 한 줄로 적습니다. 예: “천천히 걸어오다 멈춰서 웃는다”.</li>
            <li>만들어진 MiniMax H3 프롬프트를 복사해 쓰는 도구에 붙여 넣습니다.</li>
          </>
        ) : (
          <>
            <li>Upload a photo. E2P.AI fills in the scene, outfit, lighting and framing from it.</li>
            <li>Describe the motion in one line, e.g. “walks slowly toward the camera, stops and smiles”.</li>
            <li>Copy the finished MiniMax H3 prompt into the tool you use.</li>
          </>
        )}
      </ol>
      <p>
        <Link href="/generate">{ko ? "MiniMax H3 프롬프트 생성기 열기 →" : "Open the MiniMax H3 prompt generator →"}</Link>
      </p>

      {ko ? (
        <>
          <h2>MiniMax H3 프롬프트 작성 팁</h2>
          <h3>1. 무엇이 움직이는지부터</h3>
          <ul>
            <li>동작은 구체적인 동사와 방향·속도로 씁니다. ‘움직인다’보다 ‘카메라 쪽으로 천천히 걸어온다’.</li>
            <li>여러 동작이면 순서를 분명히(먼저 ~하고, 그다음 ~). E2P는 이를 시간대별로 나눠 줍니다.</li>
            <li>이미지 속 정지된 자세에 끌려가지 않도록, 원하는 움직임을 분명히 적습니다.</li>
          </ul>
          <h3>2. 카메라는 따로</h3>
          <ul>
            <li>고정(static), 천천히 다가가기(push-in), 멀어지기(pull-back)</li>
            <li>좌우 돌리기(pan), 위아래(tilt), 따라가기(tracking), 주위를 돌기(orbit)</li>
            <li>비워 두면 원본 구도를 유지합니다.</li>
          </ul>
          <h3>3. 사진과 어긋나지 않게</h3>
          <ul>
            <li>복장·배경·조명은 이미지와 맞춥니다. 이미지에 없는 사람이나 물건을 갑자기 넣지 않습니다.</li>
            <li>품질 태그를 길게 나열하기보다 평이한 문장이 낫습니다.</li>
          </ul>
          <h3>4. 진행 속도</h3>
          <p>‘빠름’은 첫 동작을 앞 20% 안에 끝내고 동작을 더 넣고, ‘천천히’는 동작 수를 줄여 부드럽게 움직입니다.</p>
        </>
      ) : (
        <>
          <h2>MiniMax H3 prompt tips</h2>
          <h3>1. Start with what moves</h3>
          <ul>
            <li>Use concrete verbs with direction and speed: “walks slowly toward the camera” rather than “moves”.</li>
            <li>For several actions, make the order clear. E2P splits them into timed segments.</li>
            <li>State the motion you want so the model isn’t pulled back to the still pose in the image.</li>
          </ul>
          <h3>2. Keep the camera separate</h3>
          <ul>
            <li>Static, push-in, pull-back</li>
            <li>Pan, tilt, tracking, orbit</li>
            <li>Leave it empty to keep the original framing.</li>
          </ul>
          <h3>3. Stay consistent with the photo</h3>
          <ul>
            <li>Match outfit, background and lighting to the image. Don’t introduce people or objects that aren’t there.</li>
            <li>Plain sentences beat long lists of quality tags.</li>
          </ul>
          <h3>4. Pacing</h3>
          <p>‘Fast’ finishes the first action within the first 20% and adds more actions; ‘Slow’ uses fewer, gentler motions.</p>
        </>
      )}

      <h2>{ko ? "MiniMax H3 프롬프트 예시" : "MiniMax H3 prompt examples"}</h2>
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
        <Link href="/generate">{ko ? "MiniMax H3 프롬프트 직접 만들어 보기 →" : "Make your own MiniMax H3 prompt →"}</Link>
      </p>
      <p className="mt-6 text-xs">
        {ko
          ? "E2P.AI가 자체적으로 정리한 작성 팁입니다. MiniMax·H3는 각 권리자의 상표이며, 모델 이름은 설명 목적으로만 사용합니다. E2P.AI는 해당 모델 제공사와 제휴 관계가 아닙니다."
          : "These are E2P.AI's own writing tips. MiniMax and H3 are trademarks of their respective owners and are used descriptively only. E2P.AI is not affiliated with the model provider."}
      </p>
    </DocPage>
  );
}
