import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { AdSlot } from "@/components/ad-slot";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";
import { LEGAL, SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/privacy", {
    ko: { title: "개인정보처리방침" },
    en: { title: "Privacy Policy" },
  });
}

export default async function PrivacyPage() {
  return (await getLocale()) === "ko" ? <Ko /> : <En />;
}

function Ko() {
  return (
    <DocPage title="개인정보처리방침" updated={LEGAL.effective}>
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
          <tr><td>업로드 이미지</td><td>이용자가 올린 이미지(촬영 위치 등 메타데이터는 제거)</td><td>프롬프트 작성, 품질 점검, 문의 대응, 부정 이용 방지, 법령에 따른 대응</td></tr>
          <tr><td>이미지 판정 정보</td><td>이미지 종류, 인물 수, 연령 추정, 판정 근거 등 AI 판정 결과</td><td>안전 정책 적용, 판정 정확도 점검</td></tr>
        </tbody>
      </table>
      <p>
        <strong>업로드 이미지</strong>는 프롬프트 작성 뒤 아래 기간 동안 <strong>암호화해 보관</strong>하고, 기간이 지나면 자동으로
        삭제합니다.
      </p>
      <ul>
        <li>모든 이미지: <strong>72시간</strong></li>
        <li>서비스 정책 위반으로 처리되지 않은 이미지: <strong>30일</strong></li>
        <li>
          법령 위반(예: 아동·청소년 성착취물, 불법 촬영물)이 의심되는 이미지: <strong>30일</strong>. 수사기관의 보존 요청이 있으면 그 요청
          기간까지 보관하며, 일반 운영 목적으로 열람하지 않습니다.
        </li>
      </ul>
      <p>
        보관된 이미지는 권한을 받은 운영자만 제한된 시간의 열람 세션을 시작해 볼 수 있으며, 모든 열람과 내려받기는 기록됩니다. 같은 이미지로 반복된 정책
        우회 시도를 막기 위해 이미지에서 계산한 해시값(원본을 복원할 수 없는 값)을 최대 24시간 보관할 수 있습니다. 보관된 이미지는 AI 모델
        학습에 사용하지 않습니다.
      </p>

      <h2>2. 보유·이용 기간</h2>
      <ul>
        <li>계정 정보: 회원 탈퇴 시까지. 다만 부정 이용 방지와 수사기관 협조를 위해 이메일 주소·계정 식별자·정지 기록은 탈퇴 후 [1년, 확정 필요] 보관한 뒤 파기</li>
        <li>요청 기록·크레딧 내역: 생성일로부터 [1년, 확정 필요] 보관한 뒤 파기 (회원 탈퇴로 앞당겨 파기하지 않음)</li>
        <li>결제 도입 시 「전자상거래법」에 따른 보관: 계약·청약철회 및 대금결제 기록 5년, 소비자 불만·분쟁 처리 기록 3년</li>
        <li>「통신비밀보호법」에 따른 접속 기록: 3개월</li>
        <li>업로드 이미지: 1항의 기간(72시간 / 30일)까지 보관한 뒤 삭제. 회원 탈퇴로 앞당겨 삭제하지 않으며, 수사기관 보존 요청 건은 요청 기간 동안 보존</li>
        <li>이미지 판정 정보: 요청 기록과 같은 기간</li>
        <li>운영자 접근 기록(이미지 열람·내려받기 포함): 1년</li>
      </ul>

      <h2>3. 제3자 제공</h2>
      <p>회사는 이용자의 동의나 법령에 근거가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.</p>
      <p>
        다만 수사기관이 영장 등 적법한 절차에 따라 요청하는 경우, 또는 아동·청소년 성착취물 등 법령 위반이 의심되어 관계 기관에 신고하는
        경우에는 관련 이미지와 기록을 제공할 수 있습니다.
      </p>

      <h2>4. 처리 위탁 및 국외 이전</h2>
      <table>
        <thead>
          <tr><th>수탁자</th><th>위탁 업무</th><th>이전 국가</th><th>이전 항목</th></tr>
        </thead>
        <tbody>
          <tr><td>Google LLC</td><td>로그인(인증)</td><td>미국</td><td>로그인 시 인증 정보</td></tr>
          <tr><td>Cloudflare, Inc.</td><td>서비스 서버 운영, AI 추론(이미지 분석·프롬프트 작성), 이미지 암호화 보관</td><td>미국 등 Cloudflare 데이터센터 소재 국가</td><td>1항의 정보, 업로드 이미지 (AI 추론은 입력을 보관하지 않는 조건)</td></tr>
          <tr><td>Neon, Inc.</td><td>데이터베이스 운영</td><td>싱가포르</td><td>1항의 정보 (이미지 제외)</td></tr>
        </tbody>
      </table>
      <p>이전 시기와 방법: 서비스 이용 시 네트워크를 통해 전송. 위탁 업체가 바뀌면 이 방침을 통해 알립니다.</p>

      <h2>5. 파기 절차와 방법</h2>
      <p>보유 기간이 끝나거나 목적을 달성한 개인정보는 지체 없이 복구할 수 없는 방법으로 삭제합니다.</p>

      <h2>6. 이용자의 권리</h2>
      <p>
        이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지와 회원 탈퇴를 요청할 수 있으며, 회사는 지체 없이 조치합니다.
        요청은 문의 이메일({SITE.contactEmail})로 할 수 있습니다. 다만 2항에서 따로 정한 정보(요청 기록, 탈퇴 후 보관하는 계정 정보 등)는 그 기간이 끝난 뒤 파기합니다.
      </p>
      <p>
        자신이 찍힌 이미지가 본인 동의 없이 업로드되었다고 생각하는 분은 회원이 아니어도 문의 이메일로 삭제를 요청할 수 있으며, 회사는 확인
        후 지체 없이 삭제합니다. 수사기관의 보존 요청이 있는 이미지는 삭제 대신 보존 사실을 안내합니다.
      </p>

      <h2>7. 안전성 확보 조치</h2>
      <ul>
        <li>세션 토큰은 해시로만 저장하고, 전송 구간을 암호화(HTTPS)합니다.</li>
        <li>개인정보 접근 권한을 최소한의 인원으로 제한하고 접근 기록을 남깁니다.</li>
        <li>안전 판정 세부값 등 내부 정보는 운영 목적 외에 사용하지 않습니다.</li>
        <li>보관 이미지는 저장소 암호화에 더해 서비스 전용 키로 한 번 더 암호화하며, 키는 별도 비밀 저장소에만 둡니다.</li>
        <li>이미지 열람은 권한을 받은 운영자가 열람 세션을 시작한 뒤 제한된 시간 동안만 가능하며, 열람·내려받기 기록을 남깁니다.</li>
      </ul>

      <h2>8. 쿠키</h2>
      <ul>
        <li>필수 쿠키: 로그인 유지를 위한 세션 쿠키와 언어 설정 쿠키를 사용합니다. 브라우저 설정에서 거부할 수 있으나, 이 경우 로그인이 필요한 기능을 이용할 수 없습니다.</li>
        <li>
          광고: 서비스는 가이드·자주 묻는 질문·이용약관 등 안내 문서 페이지와 생성기 화면 하단에 Google LLC의 애드센스 광고를 게재할 수 있습니다. 광고가 게재되는 페이지에서는 Google과
          그 파트너가 쿠키나 기기 식별자로 방문 기록 등 행태정보를 수집해 광고를 보여주거나 효과를 측정할 수 있습니다.
        </li>
        <li>첫 화면·로그인·내 계정·문의 화면에는 광고를 넣지 않습니다. 업로드한 이미지와 요청·결과 문장은 광고 업체에 보내지 않습니다.</li>
        <li>
          맞춤 광고는 <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>에서 끄거나, 브라우저에서 제3자
          쿠키를 차단해 거부할 수 있습니다. 유럽경제지역·영국·스위스 방문자에게는 광고 쿠키를 쓰기 전에 동의를 받습니다.
        </li>
      </ul>

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
      <AdSlot placement="privacy" />
    </DocPage>
  );
}

function En() {
  return (
    <DocPage title="Privacy Policy" updated={LEGAL.effective}>
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
          <tr><td>Uploaded images</td><td>Images you upload (location and other metadata removed)</td><td>Writing prompts, quality checks, support, abuse prevention, legal compliance</td></tr>
          <tr><td>Image assessment</td><td>AI results such as image type, number of people, estimated age and reasons</td><td>Applying our safety policy, checking assessment accuracy</td></tr>
        </tbody>
      </table>
      <p>
        <strong>Uploaded images</strong> are <strong>stored encrypted</strong> for the periods below and deleted
        automatically afterwards:
      </p>
      <ul>
        <li>All images: <strong>72 hours</strong></li>
        <li>Images declined under our policy: <strong>30 days</strong></li>
        <li>
          Images suspected of breaking the law (for example child sexual abuse material or non-consensual intimate
          images): <strong>30 days</strong>, or until the end of a law enforcement preservation request. These are not
          viewed for ordinary operations.
        </li>
      </ul>
      <p>
        Only authorized staff can view stored images, in a time-limited viewing session, and every view and download
        is logged. To stop repeated attempts to bypass our policy with the same image, we may keep a one-way hash of
        an image (which cannot be turned back into the image) for up to 24 hours. Stored images are never used to
        train AI models.
      </p>

      <h2>2. Retention</h2>
      <ul>
        <li>Account data: until you close your account. To prevent misuse and to cooperate with law enforcement, your email address, account identifier and suspension records are kept for [1 year, to be confirmed] after closure, then deleted.</li>
        <li>Request and credit records: [1 year, to be confirmed] from creation, then deleted. Closing your account does not shorten this.</li>
        <li>Payment records, once payments are introduced: as required by law (up to 5 years).</li>
        <li>Access logs: 3 months.</li>
        <li>Uploaded images: kept for the periods in section 1 (72 hours / 30 days), then deleted. Closing your account does not shorten this; images under a law enforcement preservation request are kept for the requested period.</li>
        <li>Image assessment data: same as request records.</li>
        <li>Staff access logs (including image views and downloads): 1 year.</li>
      </ul>

      <h2>3. Sharing</h2>
      <p>We do not sell your data or share it with third parties except as described here or required by law.</p>
      <p>
        We may provide relevant images and records to law enforcement when lawfully requested (for example with a
        warrant), or when reporting suspected illegal content such as child sexual abuse material to the authorities.
      </p>

      <h2>4. Service providers and international transfers</h2>
      <table>
        <thead>
          <tr><th>Provider</th><th>Purpose</th><th>Location</th><th>Data</th></tr>
        </thead>
        <tbody>
          <tr><td>Google LLC</td><td>Sign-in</td><td>United States</td><td>Authentication data</td></tr>
          <tr><td>Cloudflare, Inc.</td><td>Servers, AI inference (image analysis and prompt writing), encrypted image storage</td><td>United States and other countries where Cloudflare operates data centers</td><td>Data in section 1, uploaded images (AI inference does not retain inputs)</td></tr>
          <tr><td>Neon, Inc.</td><td>Database</td><td>Singapore</td><td>Data in section 1 (no images)</td></tr>
        </tbody>
      </table>

      <h2>5. Your rights</h2>
      <p>
        You can request access to, correction or deletion of your data, restriction of processing, or account closure
        at any time by emailing {SITE.contactEmail}. Depending on where you live (for example under the GDPR), you may
        also have the right to data portability and to complain to your local data protection authority. Data that section 2 says we keep for a set period (such as request records and account data kept after closure) is deleted when that period ends.
      </p>
      <p>
        If you believe an image of you was uploaded without your consent, you can ask us to delete it by email even if
        you are not a user. We will delete it without delay after checking, unless a law enforcement preservation
        request applies, in which case we will tell you so.
      </p>

      <h2>6. Security</h2>
      <p>
        Session tokens are stored only as hashes, traffic is encrypted with HTTPS, and access to personal data is
        limited and logged. Stored images are encrypted a second time with a service key kept in a separate secret
        store, and can be viewed by authorized staff only in a time-limited viewing session.
      </p>

      <h2>7. Cookies</h2>
      <ul>
        <li>Essential cookies: a session cookie to keep you signed in and a language cookie. You can block them in your browser, but then you cannot use features that need sign-in.</li>
        <li>
          Advertising: we may show Google AdSense ads (Google LLC) at the bottom of our information pages (guide, FAQ, terms and policies) and of the generator page. On those pages, Google and its partners may use
          cookies or device identifiers to show ads and measure their performance.
        </li>
        <li>We do not show ads on the home, sign-in, account or contact pages. We never send your uploaded images, requests or results to ad providers.</li>
        <li>
          You can turn off personalized ads in <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ad Settings</a> or block
          third-party cookies in your browser. Visitors from the EEA, the UK and Switzerland are asked for consent before advertising cookies are used.
        </li>
      </ul>

      <h2>8. Children</h2>
      <p>The Service is not available to children under 14 (or the minimum age in your country, if higher).</p>

      <h2>9. Contact</h2>
      <p>Privacy officer: {LEGAL.privacyOfficerEn} · {SITE.contactEmail}</p>

      <p className="mt-8 text-xs">If the Korean and English versions differ, the Korean version prevails.</p>
      <AdSlot placement="privacy" />
    </DocPage>
  );
}
