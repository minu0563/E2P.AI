import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { DocPage } from "@/components/doc-page";
import { JsonLd } from "@/components/json-ld";
import { getDictionary, getLocale } from "@/lib/i18n";
import { breadcrumbJsonLd, pageMeta } from "@/lib/seo";
import { MODELS } from "@/lib/showcase";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/guide", {
    ko: { title: "모델별 프롬프트 가이드", description: "생성 모델별 프롬프트 작성법과 예시." },
    en: { title: "Prompt Guides by Model", description: "How to write prompts for each generation model, with examples." },
  });
}

/** 가이드 목록: 모델을 고르면 /guide/<slug>. 가이드가 없는 모델은 "준비 중" */
export default async function GuideIndexPage() {
  const locale = await getLocale();
  const ko = locale === "ko";
  const modes = (await getDictionary()).home.models.modes;
  return (
    <DocPage rails="both"
      title={ko ? "모델별 프롬프트 가이드" : "Prompt guides by model"}
      lead={ko ? "쓰는 모델을 고르세요. 모델마다 잘 먹히는 프롬프트 형식이 다릅니다." : "Pick the model you use. Each model responds best to a different prompt style."}
    >
      <JsonLd data={breadcrumbJsonLd(locale, [["E2P.AI", "/"], [ko ? "프롬프트 가이드" : "Prompt guides", "/guide"]])} />
      <ul className="not-prose mt-2 grid gap-3 sm:grid-cols-2">
        {MODELS.map((m) => {
          const tags = m.modes.map((x) => modes[x]).join(" · ");
          const inner = (
            <>
              <span className={`block text-2xl font-bold tracking-tight ${m.guide ? "text-text" : "text-faint"}`}>{m.name}</span>
              <span className="mt-1 block text-sm text-muted">{tags}</span>
              <span className={`mt-3 block font-mono text-xs ${m.guide ? "text-accent" : "text-faint"}`}>
                {m.guide ? (ko ? "가이드 보기 →" : "Read the guide →") : ko ? "준비 중" : "Coming soon"}
              </span>
            </>
          );
          return (
            <li key={m.name}>
              {m.guide ? (
                <Link href={`/guide/${m.guide}`} className="block rounded-lg border border-line p-5 no-underline transition hover:border-accent">
                  {inner}
                </Link>
              ) : (
                <div className="rounded-lg border border-border p-5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>

      <AdSlot placement="guide" media="narrow" />

      <p className="mt-6 text-xs">
        {ko
          ? "모델 이름은 각 권리자의 상표이며 설명 목적으로만 사용합니다. E2P.AI는 해당 모델 제공사와 제휴 관계가 아닙니다."
          : "Model names are trademarks of their respective owners and are used descriptively only. E2P.AI is not affiliated with the model providers."}
      </p>
    </DocPage>
  );
}
