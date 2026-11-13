import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ko" ? "문의" : "Contact" };
}

export default async function ContactPage() {
  const ko = (await getLocale()) === "ko";
  return (
    <DocPage
      title={ko ? "문의" : "Contact"}
      lead={
        ko
          ? "서비스 이용, 오차단 이의 제기, 신고, 환불, 개인정보 관련 문의는 아래 이메일로 보내 주세요."
          : "For questions, appeals, reports, refunds or privacy requests, email us at the address below."
      }
    >
      <a
        href={`mailto:${SITE.contactEmail}`}
        className="flex items-center justify-between border border-line bg-surface px-5 py-4 font-mono font-medium text-text no-underline transition hover:bg-text hover:text-bg"
      >
        {SITE.contactEmail}
        <span className="text-accent">→</span>
      </a>
      <h2>{ko ? "이렇게 보내 주시면 빨리 처리할 수 있습니다" : "To help us respond quickly"}</h2>
      <ul>
        {ko ? (
          <>
            <li>오차단 이의 제기: 요청한 날짜·시각과 입력한 요청 문장 (이미지는 보내지 않아도 됩니다)</li>
            <li>환불: 가입 이메일, 결제일, 환불 사유</li>
            <li>신고: 문제가 되는 내용과 확인한 위치</li>
            <li>계정 삭제·개인정보 요청: 가입한 Google 이메일</li>
          </>
        ) : (
          <>
            <li>Appeals: the date and time of the request and the text you entered (no need to send the image)</li>
            <li>Refunds: your account email, payment date and reason</li>
            <li>Reports: what the problem is and where you saw it</li>
            <li>Account deletion or privacy requests: the Google email you signed up with</li>
          </>
        )}
      </ul>
    </DocPage>
  );
}
