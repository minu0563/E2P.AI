import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";
import { getLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ko" ? "자주 묻는 질문" : "FAQ" };
}

const KO = [
  { q: "이미지나 영상을 만들어 주나요?", a: "아니요. E2P는 프롬프트 텍스트만 만듭니다. 결과를 복사해 ComfyUI 등 사용하는 도구에 붙여 넣어 영상을 만드세요." },
  { q: "올린 이미지는 저장되나요?", a: "원본 이미지는 저장하지 않습니다. 처리하는 동안 메모리에서만 사용하고 바로 폐기합니다. 요청 문장과 처리 결과는 서비스 운영과 남용 방지를 위해 기록합니다." },
  { q: "크레딧은 어떻게 쓰이나요?", a: "프롬프트를 한 번 성공적으로 만들 때 1크레딧이 차감됩니다. 거절되거나 오류로 실패한 요청은 차감되지 않습니다. 처음 가입하면 무료 크레딧을 드립니다." },
  { q: "어떤 모델용 프롬프트인가요?", a: "현재는 MiniMax H3 이미지→영상 모델을 지원합니다. 다른 모델과 모드는 차례로 추가할 예정입니다." },
  { q: "진행 속도(천천히·보통·빠름)는 무엇인가요?", a: "영상 안에서 동작을 얼마나 촘촘하게 배치할지 정합니다. ‘빠름’은 첫 동작을 영상 앞 20% 안에 끝내고 동작을 더 많이 넣습니다." },
  { q: "‘핵심 동작 비워두기’는 무엇인가요?", a: "결과 프롬프트의 핵심 동작 자리를 빈칸으로 남겨 두는 기능입니다. 나머지 장면·카메라·조명은 채워지고, 핵심 동작은 사용하는 도구에서 직접 적으면 됩니다." },
  { q: "요청이 거절되었어요.", a: "미성년자로 보이는 인물, 성적인 이미지나 요청, 특정 타인을 지목하는 요청은 처리하지 않습니다. 정상적인 요청이 잘못 거절되었다면 문의 페이지로 알려 주세요." },
  { q: "‘일부 표현이 조정되었습니다’는 무슨 뜻인가요?", a: "실사 인물 사진에서 일부 표현이 정책에 맞지 않을 때, 요청 전체를 거절하는 대신 그 부분만 중립적인 표현으로 바꿔 작성했다는 뜻입니다." },
  { q: "언어는 어떻게 바꾸나요?", a: "브라우저 언어가 한국어면 한국어, 그 외에는 영어로 보입니다. 페이지 맨 아래에서 직접 바꿀 수 있습니다." },
];

const EN = [
  { q: "Do you generate images or videos?", a: "No. E2P only writes prompt text. Copy the result into the tool you use, such as ComfyUI, to make the video." },
  { q: "Are my images stored?", a: "No. Images are processed in memory and discarded right away. We record the request text and outcome to run the Service and prevent abuse." },
  { q: "How do credits work?", a: "Each successful prompt uses 1 credit. Declined or failed requests are free. New accounts get free credits." },
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
    </DocPage>
  );
}
