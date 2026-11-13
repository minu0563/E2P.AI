import type { Metadata } from "next";
import appConfig from "@/config/app.json";
import { getDictionary, getLocale } from "@/lib/i18n";
import { DEFAULT_PROFILE, getProfile } from "@/lib/profile";
import { Generator } from "./generator";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).generator.title };
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
    </main>
  );
}
