import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";
import { LEGAL, SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ko" ? "환불 정책" : "Refund Policy" };
}

export default async function RefundPage() {
  return (await getLocale()) === "ko" ? <Ko /> : <En />;
}

function Ko() {
  return (
    <DocPage title="환불 정책" updated={LEGAL.effective} draft>
      <p>현재 유료 상품은 판매하지 않습니다. 유료 크레딧·구독을 도입하면 아래 기준을 적용합니다.</p>

      <h2>1. 자동 반환</h2>
      <ul>
        <li>시스템 오류로 프롬프트가 만들어지지 않은 경우, 예약된 크레딧은 자동으로 돌아갑니다.</li>
        <li>정책에 따라 거절된 요청에는 크레딧이 차감되지 않습니다.</li>
      </ul>

      <h2>2. 무상 크레딧</h2>
      <p>가입·이벤트 등으로 무상 지급된 크레딧은 현금으로 환불하지 않으며, 유효기간이 지나면 소멸합니다.</p>

      <h2>3. 유료 크레딧 (충전)</h2>
      <ul>
        <li>결제일로부터 7일 이내이고 전혀 사용하지 않았다면 전액 환불합니다.</li>
        <li>일부를 사용했다면, 결제 금액에서 사용한 크레딧에 해당하는 금액과 결제 수수료를 뺀 금액을 환불합니다.</li>
        <li>크레딧은 유료·무상 중 유효기간이 먼저 끝나는 것부터 사용됩니다.</li>
      </ul>

      <h2>4. 구독</h2>
      <ul>
        <li>언제든 해지할 수 있으며, 해지해도 이미 결제한 기간이 끝날 때까지 이용할 수 있습니다.</li>
        <li>결제 후 7일 이내에 이용 내역이 없으면 전액 환불합니다.</li>
        <li>구독으로 지급된 크레딧의 이월·소멸 기준은 요금제 화면에 표시합니다.</li>
      </ul>

      <h2>5. 환불이 제한되는 경우</h2>
      <p>약관이나 <Link href="/policy">허용 가능 이용 정책</Link> 위반으로 이용이 정지된 경우, 관련 법령이 허용하는 범위에서 환불이 제한될 수 있습니다.</p>

      <h2>6. 신청 방법</h2>
      <p>
        <Link href="/contact">문의</Link>({SITE.contactEmail})로 가입 이메일, 결제일, 환불 사유를 보내 주세요. 영업일 기준 3일 안에 답변하고,
        환불은 결제 수단에 따라 3~7영업일이 걸릴 수 있습니다.
      </p>
      <p className="mt-6 text-xs">이 정책은 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관련 법령보다 이용자에게 불리하게 적용되지 않습니다.</p>
    </DocPage>
  );
}

function En() {
  return (
    <DocPage title="Refund Policy" updated={LEGAL.effective} draft>
      <p>We do not sell paid plans yet. When paid credits or subscriptions are introduced, the following applies.</p>

      <h2>1. Automatic returns</h2>
      <ul>
        <li>If a prompt is not produced because of a system error, the reserved credit is returned automatically.</li>
        <li>Requests declined by our policy do not use credits.</li>
      </ul>

      <h2>2. Free credits</h2>
      <p>Free credits (sign-up, promotions) are not refundable for cash and expire after their stated period.</p>

      <h2>3. Paid credits</h2>
      <ul>
        <li>Unused credits are fully refundable within 7 days of purchase.</li>
        <li>If you have used some, we refund the purchase price minus the value of the credits used and payment fees.</li>
        <li>Credits that expire soonest are used first.</li>
      </ul>

      <h2>4. Subscriptions</h2>
      <ul>
        <li>You can cancel at any time and keep access until the end of the paid period.</li>
        <li>If you have not used the subscription within 7 days of payment, we refund it in full.</li>
      </ul>

      <h2>5. Exceptions</h2>
      <p>Refunds may be limited, to the extent permitted by law, for accounts suspended for violating our terms or <Link href="/policy">Acceptable Use Policy</Link>.</p>

      <h2>6. How to request</h2>
      <p>
        Email us via the <Link href="/contact">Contact</Link> page ({SITE.contactEmail}) with your account email, payment date and
        reason. We reply within 3 business days; refunds take 3–7 business days depending on the payment method.
      </p>
      <p className="mt-6 text-xs">This policy does not limit any rights you have under applicable consumer protection law.</p>
    </DocPage>
  );
}
