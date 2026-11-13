import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ko" ? "소개" : "About" };
}

export default async function AboutPage() {
  return (await getLocale()) === "ko" ? <Ko /> : <En />;
}

function Ko() {
  return (
    <DocPage title={`${SITE.name} 소개`} lead={`${SITE.expansion} — ${SITE.tagline}`}>
      <p>
        <strong>E2P</strong>는 <strong>Everything to Prompt</strong>의 줄임말입니다. 이미지 한 장과 짧은 설명을 받아, 생성 AI가 잘
        이해하는 형태의 <strong>프롬프트 텍스트</strong>로 바꿔 줍니다. 지금은 MiniMax H3 이미지→영상 모델용 프롬프트로
        시작했고, 앞으로 더 많은 모드와 모델을 지원할 예정입니다.
      </p>
      <h2>하는 일</h2>
      <ul>
        <li>이미지에서 장면, 복장, 조명, 구도를 읽어 정리합니다.</li>
        <li>짧은 요청을 시간대별 동작, 카메라, 사운드로 풀어 씁니다.</li>
        <li>대상 모델이 이해하기 좋은 순서와 형식으로 프롬프트를 조립합니다.</li>
      </ul>
      <h2>하지 않는 일</h2>
      <ul>
        <li>이미지나 영상을 생성하지 않습니다. 결과 프롬프트는 이용자가 사용하는 도구에서 씁니다.</li>
      </ul>
      <p className="mt-8">
        <Link href="/generate">생성기에서 직접 써 보기 →</Link>
      </p>
      <p className="mt-6 text-xs">모델 이름은 설명 목적으로만 사용하며, 해당 모델 제공사와 제휴 관계가 없습니다.</p>
    </DocPage>
  );
}

function En() {
  return (
    <DocPage title={`About ${SITE.name}`} lead={`${SITE.expansion} — ${SITE.tagline}`}>
      <p>
        <strong>E2P</strong> stands for <strong>Everything to Prompt</strong>. Give it an image and a short
        description and it writes <strong>prompt text</strong> that generative models understand. We start with
        prompts for the MiniMax H3 image-to-video model and will add more modes and models over time.
      </p>
      <h2>What it does</h2>
      <ul>
        <li>Reads the scene, outfit, lighting and framing from your image.</li>
        <li>Expands a short request into timed actions, camera and sound.</li>
        <li>Assembles the prompt in the order and format the target model works best with.</li>
      </ul>
      <h2>What it doesn’t do</h2>
      <ul>
        <li>It does not generate images or videos. You use the prompt in your own tool.</li>
      </ul>
      <p className="mt-8">
        <Link href="/generate">Try the generator →</Link>
      </p>
      <p className="mt-6 text-xs">Model names are used for descriptive purposes only. We are not affiliated with their providers.</p>
    </DocPage>
  );
}
