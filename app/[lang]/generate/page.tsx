import type { Metadata } from "next";
import { AdSlot } from "@/components/ad-slot";
import appConfig from "@/config/app.json";
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
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
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
        limits={appConfig.limits}
        locale={await getLocale()}
        outcomes={t.me.outcomes}
        t={t.generator}
        tr={t.result}
        te={t.errors}
      />
      {/* 무료 이용 광고 1칸: 버튼·결과에서 떨어진 맨 아래. 결제 도입 후 유료 사용자는 숨긴다 */}
      <AdSlot placement="generate" className="mt-16 border-t border-border pt-6" />
    </main>
  );
}
