import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { DocPage } from "@/components/doc-page";
import creditConfig from "@/config/credits.json";
import { getLocale } from "@/lib/i18n";
import { LEGAL, SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/terms", {
    ko: { title: "이용약관" },
    en: { title: "Terms of Service" },
  });
}

export default async function TermsPage() {
  return (await getLocale()) === "ko" ? <Ko /> : <En />;
}

function Ko() {
  return (
    <DocPage title="이용약관" updated={LEGAL.effective} draft>
      <h2>제1조 (목적)</h2>
      <p>
        이 약관은 {LEGAL.operator}(이하 ‘회사’)가 제공하는 {SITE.name}(이하 ‘서비스’)의 이용 조건과 절차, 회사와 이용자의
        권리·의무를 정합니다.
      </p>

      <h2>제2조 (정의)</h2>
      <ul>
        <li><strong>프롬프트</strong>: 이용자가 다른 AI 도구에 입력하기 위해 서비스가 작성해 주는 텍스트</li>
        <li><strong>입력물</strong>: 이용자가 서비스에 올리거나 입력한 이미지와 텍스트</li>
        <li><strong>크레딧</strong>: 서비스 기능을 이용할 때 차감되는 이용 단위</li>
      </ul>

      <h2>제3조 (서비스 내용)</h2>
      <p>
        서비스는 입력물을 바탕으로 이미지·영상 생성 모델에 넣을 <strong>프롬프트 텍스트만 제공</strong>합니다. 서비스는{" "}
        <strong>이미지나 영상을 생성하지 않습니다.</strong> 서비스 화면에 표시되는 모델명은 설명 목적이며, 해당 모델 제공사와
        제휴 관계가 없습니다.
      </p>

      <h2>제4조 (약관의 효력과 변경)</h2>
      <ul>
        <li>이 약관은 서비스 화면에 게시하고, 이용자가 동의함으로써 효력이 생깁니다.</li>
        <li>회사는 관련 법령을 위반하지 않는 범위에서 약관을 바꿀 수 있으며, 시행 7일 전(이용자에게 불리한 경우 30일 전)부터 공지합니다.</li>
        <li>바뀐 약관에 동의하지 않는 이용자는 이용을 중단하고 탈퇴할 수 있습니다. 서비스는 약관 버전별 동의 기록을 보관합니다.</li>
      </ul>

      <h2>제5조 (계정)</h2>
      <ul>
        <li>이용자는 Google 계정으로 가입·로그인합니다. 회사는 비밀번호를 받거나 저장하지 않습니다.</li>
        <li>만 14세 미만은 가입할 수 없습니다.</li>
        <li>이용자는 계정을 다른 사람에게 양도·대여할 수 없으며, 계정 관리 책임은 이용자에게 있습니다.</li>
      </ul>

      <h2>제6조 (크레딧)</h2>
      <ul>
        <li>프롬프트를 한 번 성공적으로 만들 때 1크레딧이 차감됩니다(기능별 차감량은 화면에 표시).</li>
        <li>시스템 오류로 만들어지지 않았거나 이용자가 취소한 요청에는 크레딧을 차감하지 않습니다.</li>
        <li>정책에 따라 거절된 요청은 하루 3회까지 크레딧을 차감하지 않습니다. 같은 날 요청 내용 때문에 거절된 요청이 3회를 넘으면, 그 뒤 거절된 요청에는 크레딧이 차감됩니다. 이미지 판정으로 거절된 요청은 횟수와 상관없이 차감하지 않습니다.</li>
        <li>가입·이벤트로 무상 지급된 크레딧에는 유효기간이 있으며, 기간이 지나면 소멸합니다. 무상 크레딧은 환불 대상이 아닙니다.</li>
        <li>현재 서비스는 유료 판매 없이 무상 크레딧으로만 운영합니다: 가입 시 {creditConfig.signup.amount}크레딧({creditConfig.signup.expires_days}일 유효), 매일 {creditConfig.daily.amount}크레딧(그날 한국 시간 자정에 소멸, 이월되지 않음). 지급량은 공지 후 바뀔 수 있습니다.</li>
        <li>유료 크레딧의 환불은 <Link href="/refund">환불 정책</Link>을 따릅니다.</li>
        <li>하루 이용 건수 등 이용 한도를 둘 수 있습니다.</li>
      </ul>

      <h2>제7조 (이용자의 의무와 금지 행위)</h2>
      <p>이용자는 <Link href="/policy">허용 가능 이용 정책</Link>을 지켜야 하며, 다음 행위를 해서는 안 됩니다.</p>
      <ul>
        <li>본인이 아니거나 사용 동의를 받지 않은 인물의 이미지를 사용하는 행위</li>
        <li>동의 없는 성적 콘텐츠, 딥페이크(허위영상물) 제작을 목적으로 하는 이용</li>
        <li>미성년자가 등장하는 성적·암시적 콘텐츠와 관련된 일체의 이용</li>
        <li>특정 개인을 지목해 모욕·괴롭힘·명예훼손을 하려는 이용</li>
        <li>차단 정책을 우회하려는 시도, 자동화된 대량 요청, 서비스 운영 방해</li>
        <li>타인의 저작권·초상권 등 권리를 침해하는 이용</li>
      </ul>

      <h2>제8조 (권리 귀속)</h2>
      <ul>
        <li>입력물에 대한 권리는 이용자에게 있습니다. 이용자는 입력물을 사용할 정당한 권리를 가지고 있어야 합니다.</li>
        <li>서비스가 만들어 준 프롬프트는 이용자가 자유롭게 사용할 수 있습니다.</li>
        <li>서비스의 소프트웨어, 디자인, 안내 문서에 대한 권리는 회사에 있습니다.</li>
      </ul>

      <h2>제9조 (입력물의 보관)</h2>
      <ul>
        <li>
          회사는 서비스 제공, 품질 점검, 문의 대응, 부정 이용 방지 및 법령에 따른 대응을 위해 이용자가 올린 이미지를{" "}
          <Link href="/privacy">개인정보처리방침</Link>에 정한 기간 동안 암호화해 보관하며, 기간이 지나면 삭제합니다.
        </li>
        <li>회사는 보관 중인 이미지를 위 목적 외에 사용하지 않으며, AI 모델 학습에 사용하지 않습니다.</li>
      </ul>

      <h2>제10조 (불법 콘텐츠와 수사 협조)</h2>
      <ul>
        <li>
          이용자는 본인이 아니거나 사용 동의를 받지 않은 인물의 이미지, 아동·청소년이 등장하는 성적 이미지, 불법 촬영물 등 법령을
          위반하는 이미지를 올려서는 안 됩니다.
        </li>
        <li>회사는 법령 위반이 의심되는 이미지와 관련 기록을 보관하고, 관계 법령에 따라 수사기관에 신고하거나 제공할 수 있습니다.</li>
        <li>회사는 이 조를 위반한 이용자의 이용을 사전 통지 없이 제한하거나 계약을 해지할 수 있습니다.</li>
        <li>
          이용자가 동의 없이 타인의 이미지를 올려 발생한 분쟁과 손해는 그 이용자에게 책임이 있으며, 회사에 손해가 발생한 경우 이용자는
          이를 배상해야 합니다.
        </li>
      </ul>

      <h2>제11조 (요청 처리 제한과 이용 제한)</h2>
      <ul>
        <li>서비스는 정책에 맞지 않는 요청을 거절하거나 일부 표현을 중립적으로 조정할 수 있습니다.</li>
        <li>위반이 반복되면 경고, 일시 제한, 이용 정지 순으로 조치할 수 있으며, 중대한 위반은 바로 정지할 수 있습니다.</li>
        <li>이용자는 조치에 이의가 있으면 <Link href="/contact">문의</Link>로 이의를 제기할 수 있습니다.</li>
      </ul>

      <h2>제12조 (서비스 변경·중단)</h2>
      <p>
        회사는 운영·기술상 필요에 따라 서비스 내용, 사용 모델, 인프라 공급업체를 바꿀 수 있습니다. 서비스를 중단할 때는
        미리 공지하고, 남은 유료 크레딧은 환불 정책에 따라 처리합니다.
      </p>

      <h2>제13조 (책임의 한계)</h2>
      <ul>
        <li>프롬프트는 참고용 텍스트이며, 외부 도구에서 만든 결과물의 품질이나 결과를 보장하지 않습니다.</li>
        <li>이용자가 프롬프트로 만든 결과물과 그 사용에 대한 책임은 이용자에게 있습니다.</li>
        <li>회사의 고의 또는 중대한 과실로 인한 손해는 관련 법령에 따라 배상합니다.</li>
      </ul>

      <h2>제14조 (분쟁 해결)</h2>
      <p>이 약관은 대한민국 법을 따르며, 분쟁은 민사소송법상 관할 법원에서 해결합니다.</p>

      <h2>부칙</h2>
      <p>이 약관은 {LEGAL.effective}부터 시행합니다.</p>
      <AdSlot placement="terms" />
    </DocPage>
  );
}

function En() {
  return (
    <DocPage title="Terms of Service" updated={LEGAL.effective} draft>
      <h2>1. About these terms</h2>
      <p>
        These terms govern your use of {SITE.name} (the “Service”), operated by {LEGAL.operatorEn} (“we”, “us”). By
        creating an account you agree to them.
      </p>

      <h2>2. What the Service does</h2>
      <p>
        The Service turns the images and text you provide into <strong>prompt text</strong> for image and video
        generation models. <strong>We do not generate images or videos.</strong> Model names are shown for
        descriptive purposes only; we are not affiliated with their providers.
      </p>

      <h2>3. Changes to these terms</h2>
      <p>
        We may update these terms. We will give at least 7 days’ notice (30 days for changes that are less favorable
        to you). If you do not agree, you may stop using the Service and close your account. We keep a record of the
        version you accepted.
      </p>

      <h2>4. Accounts</h2>
      <ul>
        <li>You sign in with a Google account. We never receive or store your password.</li>
        <li>You must be at least 14 years old (or the minimum age required in your country, if higher).</li>
        <li>You may not share or transfer your account and are responsible for activity on it.</li>
      </ul>

      <h2>5. Credits</h2>
      <ul>
        <li>Each successful prompt uses 1 credit unless the screen states otherwise.</li>
        <li>Requests that fail due to system errors or that you cancel do not use credits.</li>
        <li>Up to 3 requests declined by our policy per day do not use credits. After more than 3 requests are declined in a day because of what was requested, further declined requests use a credit. Requests declined because of the image never use credits.</li>
        <li>Free credits (sign-up, promotions) expire after the stated period and are not refundable.</li>
        <li>The Service currently runs on free credits only, with no paid plans: {creditConfig.signup.amount} credits on sign-up (valid for {creditConfig.signup.expires_days} days) and {creditConfig.daily.amount} credits each day (expiring at midnight Korea time, not carried over). Amounts may change after notice.</li>
        <li>Paid credits are refunded according to our <Link href="/refund">Refund Policy</Link>.</li>
        <li>Daily usage limits may apply.</li>
      </ul>

      <h2>6. Your responsibilities</h2>
      <p>You must follow our <Link href="/policy">Acceptable Use Policy</Link>. In particular, you may not:</p>
      <ul>
        <li>use images of anyone other than yourself or people who have consented;</li>
        <li>create non-consensual sexual content or deepfakes;</li>
        <li>use the Service in any way involving sexual or suggestive content of minors;</li>
        <li>target a specific person for harassment, insult or defamation;</li>
        <li>attempt to bypass our safety systems, send automated bulk requests or disrupt the Service;</li>
        <li>infringe anyone’s copyright, likeness or other rights.</li>
      </ul>

      <h2>7. Ownership</h2>
      <ul>
        <li>You keep your rights to your inputs and must have the right to use them.</li>
        <li>You may use the prompts the Service produces freely.</li>
        <li>We own the Service’s software, design and documentation.</li>
      </ul>

      <h2>8. Storage of inputs</h2>
      <ul>
        <li>
          We store the images you upload, encrypted, for the periods set out in the{" "}
          <Link href="/privacy">Privacy Policy</Link> to provide the Service, check quality, handle support requests,
          prevent abuse and comply with the law, and delete them when those periods end.
        </li>
        <li>We do not use stored images for any other purpose, and never to train AI models.</li>
      </ul>

      <h2>9. Illegal content and cooperation with authorities</h2>
      <ul>
        <li>
          You must not upload images of people other than yourself who have not consented, sexual images involving
          minors, non-consensual intimate images or any other unlawful images.
        </li>
        <li>We may keep images and records suspected of breaking the law and report or provide them to the authorities as the law allows.</li>
        <li>We may restrict or close accounts that break this section without prior notice.</li>
        <li>
          You are responsible for disputes and damages caused by uploading images of others without their consent,
          and must compensate us for any resulting loss to the extent the law allows.
        </li>
      </ul>

      <h2>10. Request handling and enforcement</h2>
      <p>
        We may decline requests that do not meet our policy or neutralize parts of them. Repeated violations may lead
        to a warning, a temporary restriction and then suspension; serious violations may lead to immediate
        suspension. You can appeal via the <Link href="/contact">Contact</Link> page.
      </p>

      <h2>11. Changes to the Service</h2>
      <p>
        We may change features, models or infrastructure providers. If we discontinue the Service, we will give notice
        and handle remaining paid credits under the Refund Policy.
      </p>

      <h2>12. Disclaimers and liability</h2>
      <ul>
        <li>Prompts are provided as-is for reference. We do not guarantee results produced in third-party tools.</li>
        <li>You are responsible for content you create with the prompts and how you use it.</li>
        <li>Nothing in these terms limits liability that cannot be limited under applicable law.</li>
      </ul>

      <h2>13. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of Korea. Mandatory consumer protections of your country of residence still apply.</p>

      <p className="mt-8 text-xs">If the Korean and English versions differ, the Korean version prevails.</p>
      <AdSlot placement="terms" />
    </DocPage>
  );
}
