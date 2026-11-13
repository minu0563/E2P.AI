import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";
import { LEGAL, SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ko" ? "개인정보처리방침" : "Privacy Policy" };
}

export default async function PrivacyPage() {
  return (await getLocale()) === "ko" ? <Ko /> : <En />;
}

function Ko() {
  return (
    <DocPage title="개인정보처리방침" updated={LEGAL.effective} draft>
      <p>
        {LEGAL.operator}(이하 ‘회사’)는 「개인정보 보호법」에 따라 {SITE.name} 이용자의 개인정보를 보호하고, 관련 고충을 신속하게
        처리하기 위해 다음과 같이 개인정보처리방침을 둡니다.
      </p>

      <h2>1. 처리하는 개인정보와 목적</h2>
      <table>
        <thead>
          <tr><th>구분</th><th>항목</th><th>목적</th></tr>
        </thead>
        <tbody>
          <tr><td>회원 가입·로그인</td><td>Google 계정 이메일, 이름, Google 계정 식별자</td><td>본인 확인, 계정 관리, 부정 이용 방지</td></tr>
          <tr><td>약관 동의</td><td>동의한 약관 버전, 동의 시각</td><td>동의 사실 증빙</td></tr>
          <tr><td>서비스 이용</td><td>요청 문장, 처리 결과, 거절 사유 코드, 크레딧 내역, 만족도 피드백</td><td>서비스 제공, 크레딧 정산, 품질 개선, 남용 방지</td></tr>
          <tr><td>자동 수집</td><td>접속 기록, 세션 쿠키, 언어 설정 쿠키</td><td>로그인 유지, 보안, 언어 표시</td></tr>
        </tbody>
      </table>
      <p>
        <strong>업로드 이미지</strong>는 프롬프트 작성을 위해 처리하는 동안에만 메모리에서 사용하며,{" "}
        <strong>원본을 저장하지 않습니다.</strong> 같은 이미지로 반복된 정책 우회 시도를 막기 위해 이미지에서 계산한 해시값(원본을 복원할 수
        없는 값)을 최대 24시간 보관할 수 있습니다.
      </p>

      <h2>2. 보유·이용 기간</h2>
      <ul>
        <li>계정 정보: 회원 탈퇴 시까지 (탈퇴 후 지체 없이 파기)</li>
        <li>요청 기록·크레딧 내역: [보관 기간 확정 필요] 후 파기</li>
        <li>결제 도입 시 「전자상거래법」에 따른 보관: 계약·청약철회 및 대금결제 기록 5년, 소비자 불만·분쟁 처리 기록 3년</li>
        <li>「통신비밀보호법」에 따른 접속 기록: 3개월</li>
      </ul>

      <h2>3. 제3자 제공</h2>
      <p>회사는 이용자의 동의나 법령에 근거가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.</p>

      <h2>4. 처리 위탁 및 국외 이전</h2>
      <table>
        <thead>
          <tr><th>수탁자</th><th>위탁 업무</th><th>이전 국가</th><th>이전 항목</th></tr>
        </thead>
        <tbody>
          <tr><td>Google LLC</td><td>로그인(인증)</td><td>미국</td><td>로그인 시 인증 정보</td></tr>
          <tr><td>[호스팅 업체]</td><td>서비스 서버·데이터베이스 운영</td><td>[국가]</td><td>1항의 정보</td></tr>
          <tr><td>[AI 추론 업체]</td><td>이미지 분석·프롬프트 작성</td><td>[국가]</td><td>업로드 이미지, 요청 문장 (처리 후 보관하지 않는 조건)</td></tr>
        </tbody>
      </table>
      <p>이전 시기와 방법: 서비스 이용 시 네트워크를 통해 전송. 위탁 업체가 바뀌면 이 방침을 통해 알립니다.</p>

      <h2>5. 파기 절차와 방법</h2>
      <p>보유 기간이 끝나거나 목적을 달성한 개인정보는 지체 없이 복구할 수 없는 방법으로 삭제합니다.</p>

      <h2>6. 이용자의 권리</h2>
      <p>
        이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지와 회원 탈퇴를 요청할 수 있으며, 회사는 지체 없이 조치합니다.
        요청은 문의 이메일({SITE.contactEmail})로 할 수 있습니다.
      </p>

      <h2>7. 안전성 확보 조치</h2>
      <ul>
        <li>세션 토큰은 해시로만 저장하고, 전송 구간을 암호화(HTTPS)합니다.</li>
        <li>개인정보 접근 권한을 최소한의 인원으로 제한하고 접근 기록을 남깁니다.</li>
        <li>안전 판정 세부값 등 내부 정보는 운영 목적 외에 사용하지 않습니다.</li>
      </ul>

      <h2>8. 쿠키</h2>
      <p>
        로그인 유지를 위한 세션 쿠키와 언어 설정 쿠키만 사용합니다. 광고·추적 쿠키를 사용하게 되면 이 방침을 바꾸고 동의를 받습니다.
        브라우저 설정에서 쿠키를 거부할 수 있으나, 이 경우 로그인이 필요한 기능을 이용할 수 없습니다.
      </p>

      <h2>9. 만 14세 미만 아동</h2>
      <p>서비스는 만 14세 미만 아동의 가입을 받지 않습니다.</p>

      <h2>10. 개인정보 보호책임자</h2>
      <ul>
        <li>책임자: {LEGAL.privacyOfficer}</li>
        <li>연락처: {SITE.contactEmail}</li>
      </ul>
      <p>
        개인정보 침해에 대한 상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118), 개인정보분쟁조정위원회(kopico.go.kr,
        1833-6972)에 문의할 수 있습니다.
      </p>

      <h2>11. 방침 변경</h2>
      <p>이 방침은 {LEGAL.effective}부터 적용되며, 바뀌는 경우 시행 7일 전부터 공지합니다.</p>
    </DocPage>
  );
}

function En() {
  return (
    <DocPage title="Privacy Policy" updated={LEGAL.effective} draft>
      <p>
        This policy explains how {LEGAL.operatorEn} (“we”) handles personal information when you use {SITE.name}.
      </p>

      <h2>1. What we collect and why</h2>
      <table>
        <thead>
          <tr><th>Category</th><th>Data</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td>Account</td><td>Google email, name, Google account ID</td><td>Sign-in, account management, abuse prevention</td></tr>
          <tr><td>Consent</td><td>Accepted terms version and time</td><td>Record of consent</td></tr>
          <tr><td>Usage</td><td>Request text, outcome, decline reason code, credit history, feedback</td><td>Providing the Service, billing credits, quality, abuse prevention</td></tr>
          <tr><td>Automatic</td><td>Access logs, session cookie, language cookie</td><td>Keeping you signed in, security, language</td></tr>
        </tbody>
      </table>
      <p>
        <strong>Uploaded images</strong> are processed in memory only and are <strong>never stored</strong>. To stop
        repeated attempts to bypass our policy with the same image, we may keep a one-way hash of an image (which
        cannot be turned back into the image) for up to 24 hours.
      </p>

      <h2>2. Retention</h2>
      <ul>
        <li>Account data: until you close your account, then deleted without delay.</li>
        <li>Request and credit records: [retention period to be confirmed].</li>
        <li>Payment records, once payments are introduced: as required by law (up to 5 years).</li>
        <li>Access logs: 3 months.</li>
      </ul>

      <h2>3. Sharing</h2>
      <p>We do not sell your data or share it with third parties except as described here or required by law.</p>

      <h2>4. Service providers and international transfers</h2>
      <table>
        <thead>
          <tr><th>Provider</th><th>Purpose</th><th>Location</th><th>Data</th></tr>
        </thead>
        <tbody>
          <tr><td>Google LLC</td><td>Sign-in</td><td>United States</td><td>Authentication data</td></tr>
          <tr><td>[Hosting provider]</td><td>Servers and database</td><td>[Country]</td><td>Data in section 1</td></tr>
          <tr><td>[AI inference provider]</td><td>Image analysis and prompt writing</td><td>[Country]</td><td>Uploaded image, request text (not retained after processing)</td></tr>
        </tbody>
      </table>

      <h2>5. Your rights</h2>
      <p>
        You can request access to, correction or deletion of your data, restriction of processing, or account closure
        at any time by emailing {SITE.contactEmail}. Depending on where you live (for example under the GDPR), you may
        also have the right to data portability and to complain to your local data protection authority.
      </p>

      <h2>6. Security</h2>
      <p>Session tokens are stored only as hashes, traffic is encrypted with HTTPS, and access to personal data is limited and logged.</p>

      <h2>7. Cookies</h2>
      <p>We only use a session cookie and a language cookie. We will update this policy and ask for consent before using any advertising or tracking cookies.</p>

      <h2>8. Children</h2>
      <p>The Service is not available to children under 14 (or the minimum age in your country, if higher).</p>

      <h2>9. Contact</h2>
      <p>Privacy officer: {LEGAL.privacyOfficer} · {SITE.contactEmail}</p>

      <p className="mt-8 text-xs">If the Korean and English versions differ, the Korean version prevails.</p>
    </DocPage>
  );
}
