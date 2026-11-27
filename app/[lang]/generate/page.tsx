import type { Metadata } from "next";
import { AdRail, AdSlot } from "@/components/ad-slot";
import appConfig from "@/config/app.json";
import creditsConfig from "@/config/credits.json";
import { getDictionary, getLocale } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { DEFAULT_PROFILE, getProfile } from "@/lib/profile";
import { Generator } from "./generator";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/generate", {
    ko: { title: "프롬프트 생성기", description: "이미지를 올리고 원하는 동작을 적으면 영상 프롬프트를 만들어 줍니다." },
    en: { title: "Prompt Generator", description: "Upload an image, describe the motion, and get a video prompt." },
  });
}

export default async function GeneratePage() {
  const profile = getProfile(DEFAULT_PROFILE)!;
  const t = await getDictionary();
  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 py-10">
      {/* 큰 화면: 작업 영역 바깥 오른쪽 여백에 세로 광고 1칸 (결과·복사 버튼과 떨어뜨린다) */}
      <AdRail side="right" gap="1.5rem" />
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">{t.generator.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.035em]">{t.generator.title}</h1>
        </div>
      </div>
      <Generator
        profileId={profile.profile}
        fields={profile.fields}
        groups={profile.groups}
        paces={profile.paces}
        duration={profile.duration}
        aspectRatios={profile.aspect_ratios}
        placeholder={profile.placeholder}
        placeholderEnabled={appConfig.features.placeholder_mode}
        startEndEnabled={appConfig.features.start_end_frames}
        startEndCost={creditsConfig.cost.start_end}
        limits={appConfig.limits}
        locale={await getLocale()}
        outcomes={t.me.outcomes}
        t={t.generator}
        tr={t.result}
        te={t.errors}
      />
      {/* 작은 화면: 버튼·결과에서 떨어진 맨 아래 1칸 (큰 화면은 위의 오른쪽 세로 광고). 결제 도입 후 유료 사용자는 숨긴다 */}
      <AdSlot placement="generate" media="narrow" className="mt-16 border-t border-border pt-6" />
    </main>
  );
}
