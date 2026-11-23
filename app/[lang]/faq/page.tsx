import { AdSlot } from "@/components/ad-slot";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { DocPage } from "@/components/doc-page";
import creditConfig from "@/config/credits.json";
import { getLocale } from "@/lib/i18n";

const { signup: SIGNUP, daily: DAILY } = creditConfig;

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/faq", {
    ko: { title: "자주 묻는 질문", description: "E2P.AI 이미지→영상 프롬프트 생성기의 사용법, 크레딧, 정책에 대한 자주 묻는 질문." },
    en: { title: "FAQ", description: "Frequently asked questions about the E2P.AI image-to-video prompt generator: usage, credits and policies." },
  });
}

const KO = [
  { q: "이미지나 영상을 만들어 주나요?", a: "아니요. E2P는 프롬프트 텍스트만 만듭니다. 결과를 복사해 ComfyUI 등 사용하는 도구에 붙여 넣어 영상을 만드세요." },
  { q: "올린 이미지는 저장되나요?", a: "품질 점검, 문의 대응, 부정 이용 방지를 위해 정해진 기간만 암호화해 보관하고, 기간이 지나면 자동으로 삭제합니다. 모든 이미지는 72시간, 정책 위반으로 처리되지 않은 이미지는 30일입니다. 촬영 위치 등 메타데이터는 지운 뒤 보관하며, AI 학습에는 쓰지 않습니다. 요청 문장과 처리 결과도 서비스 운영과 남용 방지를 위해 기록합니다. 자세한 내용은 개인정보처리방침을 확인해 주세요." },
  { q: "제 사진이 동의 없이 올라간 것 같아요.", a: "회원이 아니어도 문의 이메일로 삭제를 요청할 수 있습니다. 확인 후 지체 없이 삭제합니다." },
  { q: "크레딧은 어떻게 쓰이나요?", a: `프롬프트를 한 번 성공적으로 만들 때 1크레딧이 차감됩니다. 거절되거나 오류로 실패한 요청은 차감되지 않습니다. 지금은 유료 판매 없이 무료로만 운영합니다. 처음 가입하면 ${SIGNUP.amount}크레딧(${SIGNUP.expires_days}일 유효), 매일 ${DAILY.amount}크레딧을 드립니다. 매일 드리는 크레딧은 그날 한국 시간 자정에 사라지고 쌓이지 않습니다.` },
  { q: "어떤 모델용 프롬프트인가요?", a: "현재는 MiniMax H3 이미지→영상 모델을 지원합니다. 다른 모델과 모드는 차례로 추가할 예정입니다." },
  { q: "진행 속도(천천히·보통·빠름)는 무엇인가요?", a: "영상 안에서 동작을 얼마나 촘촘하게 배치할지 정합니다. ‘빠름’은 첫 동작을 영상 앞 20% 안에 끝내고 동작을 더 많이 넣습니다." },
  { q: "‘핵심 동작 비워두기’는 무엇인가요?", a: "결과 프롬프트의 핵심 동작 자리를 빈칸으로 남겨 두는 기능입니다. 나머지 장면·카메라·조명은 채워지고, 핵심 동작은 사용하는 도구에서 직접 적으면 됩니다." },
  { q: "요청이 거절되었어요.", a: "미성년자로 보이는 인물, 성적인 이미지나 요청, 특정 타인을 지목하는 요청은 처리하지 않습니다. 정상적인 요청이 잘못 거절되었다면 문의 페이지로 알려 주세요." },
  { q: "‘일부 표현이 조정되었습니다’는 무슨 뜻인가요?", a: "실사 인물 사진에서 일부 표현이 정책에 맞지 않을 때, 요청 전체를 거절하는 대신 그 부분만 중립적인 표현으로 바꿔 작성했다는 뜻입니다." },
  { q: "언어는 어떻게 바꾸나요?", a: "브라우저 언어가 한국어면 한국어, 그 외에는 영어로 보입니다. 페이지 맨 아래에서 직접 바꿀 수 있습니다." },
];

const EN = [
  { q: "Do you generate images or videos?", a: "No. E2P only writes prompt text. Copy the result into the tool you use, such as ComfyUI, to make the video." },
  { q: "Are my images stored?", a: "Yes, for a limited time only. To check quality, handle support requests and prevent abuse, we keep images encrypted and delete them automatically: all images after 72 hours, images declined under our policy after 30 days. Location and other metadata are removed first, and images are never used to train AI models. We also record the request text and outcome to run the Service and prevent abuse. See the Privacy Policy for details." },
  { q: "I think a photo of me was uploaded without my consent.", a: "You can ask us to delete it by email, even if you are not a user. We will delete it without delay after checking." },
  { q: "How do credits work?", a: `Each successful prompt uses 1 credit. Declined or failed requests are free. The service is currently free only, with no paid plans. New accounts get ${SIGNUP.amount} credits (valid for ${SIGNUP.expires_days} days), plus ${DAILY.amount} credits every day. Daily credits expire at midnight Korea time and do not add up.` },
  { q: "Which model are the prompts for?", a: "Currently the MiniMax H3 image-to-video model. More models and modes are coming." },
  { q: "What does pacing (slow / normal / fast) do?", a: "It controls how densely actions are placed in the clip. ‘Fast’ finishes the first action within the first 20% and adds more actions." },
  { q: "What is ‘leave the key action blank’?", a: "It keeps a placeholder where the key action goes. Everything else is filled in, and you write the key action in your own tool." },
  { q: "My request was declined.", a: "We don’t process people who look underage, sexual images or requests, or requests that identify a specific other person. If a normal request was declined, let us know via Contact." },
  { q: "What does ‘Some wording was adjusted’ mean?", a: "For photos of real people, part of the request was rewritten neutrally instead of declining the whole request." },
  { q: "How do I change the language?", a: "If your browser language is Korean you see Korean, otherwise English. You can switch at the bottom of any page." },
];

export default async function FaqPage() {
  const ko = (await getLocale()) === "ko";
  return (
    <DocPage title={ko ? "자주 묻는 질문" : "Frequently asked questions"}>
      <div className="border-t border-line">
        {(ko ? KO : EN).map((f) => (
          <details key={f.q} className="group border-b border-border py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-text">
              {f.q}
              <span className="text-faint transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm">{f.a}</p>
          </details>
        ))}
      </div>
      <AdSlot placement="faq" />
    </DocPage>
  );
}
