import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";
import { LEGAL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ko" ? "허용 가능 이용 정책" : "Acceptable Use Policy" };
}

export default async function PolicyPage() {
  return (await getLocale()) === "ko" ? <Ko /> : <En />;
}

function Ko() {
  return (
    <DocPage
      title="허용 가능 이용 정책"
      updated={LEGAL.effective}
      draft
      lead="안전한 이용을 위해 아래 기준으로 요청을 처리합니다. 이 기준은 서버에서 자동으로 적용됩니다."
    >
      <h2>처리하지 않는 요청</h2>
      <ul>
        <li>미성년자로 보이는 인물이 포함된 이미지</li>
        <li>나이를 확인하기 어려운 인물이 포함된 이미지에 대한 일상적이지 않은 요청(수영복·침대 등 민감한 복장·장소 포함)</li>
        <li>성적인 이미지, 노골적인 성적 요청</li>
        <li>사진 속 인물을 특정 타인(전 연인, 동료, 연예인, 실명 등)으로 지목하는 요청</li>
        <li>동의 없는 성적 콘텐츠, 딥페이크(허위영상물) 제작을 목적으로 하는 요청</li>
        <li>차단을 우회하려는 시도(은어, 오타, 이미지 속 글자로 지시하기 등)</li>
      </ul>

      <h2>조정될 수 있는 요청</h2>
      <p>
        실사 인물 사진에서 암시적인 표현이 포함된 요청은 해당 부분을 중립적인 표현으로 바꿔 작성하거나 거절할 수 있습니다. 이 경우
        결과에 ‘일부 표현이 조정되었습니다’라고 안내합니다.
      </p>

      <h2>일반적으로 허용되는 요청</h2>
      <ul>
        <li>수영복·해변, 일반적인 춤, 스포츠, 패션, 일상 동작</li>
        <li>풍경, 사물, 자동차, 동물, 제품 영상</li>
        <li>일러스트·가상 캐릭터의 일반적인 동작</li>
      </ul>

      <h2>위반 시 조치</h2>
      <p>짧은 시간에 반복해서 거절되는 요청이 확인되면 경고, 일시 제한, 이용 정지 순으로 조치합니다. 거절된 요청에는 크레딧이 차감되지 않지만, 위반 횟수에는 포함됩니다.</p>

      <h2>오차단 이의 제기</h2>
      <p>정상적인 요청이 거절되었다면 <Link href="/contact">문의</Link>로 알려 주세요. 검토 후 기준 개선에 반영합니다.</p>
      <AdSlot placement="policy" />
    </DocPage>
  );
}

function En() {
  return (
    <DocPage
      title="Acceptable Use Policy"
      updated={LEGAL.effective}
      draft
      lead="To keep the Service safe, requests are handled by the rules below. They are applied automatically on our servers."
    >
      <h2>Requests we decline</h2>
      <ul>
        <li>Images that include people who look underage</li>
        <li>Anything beyond everyday requests for images with people whose age cannot be confirmed (including sensitive outfits or settings such as swimwear or beds)</li>
        <li>Sexual images and explicit sexual requests</li>
        <li>Requests that identify the person in a photo as a specific other person (an ex, a coworker, a celebrity, a real name)</li>
        <li>Requests intended to create non-consensual sexual content or deepfakes</li>
        <li>Attempts to bypass our filters (slang, misspellings, instructions written inside the image, etc.)</li>
      </ul>

      <h2>Requests we may adjust</h2>
      <p>
        For photos of real people, suggestive wording may be rewritten neutrally or declined. When this happens, the
        result says “Some wording was adjusted.”
      </p>

      <h2>Generally allowed</h2>
      <ul>
        <li>Swimwear at the beach, everyday dancing, sports, fashion and daily activities</li>
        <li>Landscapes, objects, cars, animals and product videos</li>
        <li>Ordinary motion for illustrated or virtual characters</li>
      </ul>

      <h2>Enforcement</h2>
      <p>Repeated declined requests in a short period lead to a warning, a temporary restriction and then suspension. Declined requests do not use credits but do count toward violations.</p>

      <h2>Appeals</h2>
      <p>If a legitimate request was declined, tell us via <Link href="/contact">Contact</Link>. We review appeals and use them to improve our rules.</p>
      <AdSlot placement="policy" />
    </DocPage>
  );
}
