import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { getDictionary, getLocale } from "@/lib/i18n";
import { HOME_META, homeJsonLd, pageMeta } from "@/lib/seo";
import { MODELS, SHOWCASE } from "@/lib/showcase";
import { SITE } from "@/lib/site";
import "./home.css";

const SAMPLE = `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

integrated_multimodal_description: [Shot 1] Live-action, the woman in <Picture 1> wears a white linen shirt. A sandy beach at sunset. She takes a breath and starts jogging along the wet sand, arms swinging loosely. Then she slows to a stop and turns her head back over her shoulder.

overall_soundscape: Waves rolling onto the shore and a light wind.

non_diegetic_music: N/A`;

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/", HOME_META);
}

function Heading({ label, title, children }: { label: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-12 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="label">{label}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-[2.6rem]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default async function Home() {
  const dict = await getDictionary();
  const locale = await getLocale();
  const t = dict.home;
  const show = SHOWCASE[0];
  const request = show.request[locale];
  return (
    <main>
      <JsonLd data={homeJsonLd(locale)} />
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-14 px-4 pt-16 pb-20 md:pt-24 lg:grid-cols-[1fr_460px] lg:items-center">
        <div>
          <p className="label">{t.badge}</p>
          <h1 className="mt-6 text-[3rem] leading-[0.98] font-bold tracking-[-0.045em] sm:text-[4.6rem]">
            {t.title1}
            <br />
            {t.title2.replace(/\.$/, "")}
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-7 text-lg text-muted">{t.lead}</p>
          <div className="mt-8 flex items-center gap-5">
            <Link href="/generate" className="btn btn-primary px-5 py-3">
              {t.cta} <span aria-hidden>→</span>
            </Link>
            <Link href="/guide" className="text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-accent">
              {t.secondary}
            </Link>
          </div>
        </div>

        {/* 요청 한 줄 → 프롬프트 */}
        <div>
          <p className="text-2xl font-semibold tracking-tight">“{t.demoRequest}”</p>
          <p aria-hidden className="my-4 font-mono text-accent">↓</p>
          <pre className="border-l-2 border-accent pl-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">
            {SAMPLE}
          </pre>
        </div>
      </section>

      {/* 01 이미지 → 프롬프트 → 영상 */}
      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-4 py-24">
          <Heading label={`01 · ${t.showcase.label}`} title={t.showcase.title} />

          <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1.25fr_auto_1fr] lg:gap-3">
            {/* 이미지 */}
            <figure className="mx-auto flex w-full max-w-[300px] flex-col lg:max-w-none">
              <StageLabel n={1} text={t.showcase.image} />
              <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-border bg-surface">
                {show.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 운영자가 넣는 정적 예시 이미지
                  <img src={show.image} alt="" className="size-full object-cover" />
                ) : (
                  <Slot text={t.showcase.imageSlot} hint="public/showcase/1-image.jpg → lib/showcase.ts" />
                )}
              </div>
            </figure>

            <Arrow />

            {/* 프롬프트 */}
            <figure className="flex flex-col">
              <StageLabel n={2} text={t.showcase.prompt} />
              <div className="flex flex-1 flex-col rounded-lg bg-text p-5 text-bg">
                <p className="font-mono text-[11px] opacity-50">
                  {t.showcase.request}
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight">“{request}”</p>
                <div className="my-4 h-px bg-bg/15" />
                <pre className="flex-1 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap opacity-80">
                  {show.prompt}
                </pre>
              </div>
            </figure>

            <Arrow />

            {/* 영상 */}
            <figure className="mx-auto flex w-full max-w-[300px] flex-col lg:max-w-none">
              <StageLabel n={3} text={t.showcase.video} />
              <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-border bg-surface">
                {show.video ? (
                  <video src={show.video} poster={show.image ?? undefined} autoPlay muted loop playsInline preload="metadata" className="size-full object-cover" />
                ) : (
                  <Slot text={t.showcase.videoSlot} hint="public/showcase/1-video.mp4 → lib/showcase.ts" play />
                )}
              </div>
            </figure>
          </div>

          <p className="mt-6 text-xs text-faint">{t.showcase.note}</p>
        </div>
      </section>

      {/* 02 지원 모델 */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-24">
          <Heading label={`02 · ${t.models.label}`} title={t.models.title}>
            <p className="max-w-xs text-sm text-muted md:text-right">{t.models.body}</p>
          </Heading>
          <ul className="border-t border-line">
            {MODELS.map((m) => (
              <li
                key={m.name}
                className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 border-b border-border py-6 sm:grid-cols-[1fr_auto_120px]"
              >
                <span
                  className={`text-4xl font-bold tracking-[-0.04em] sm:text-6xl ${m.live ? "text-text" : "text-faint"}`}
                >
                  {m.guide ? (
                    <Link href={`/guide/${m.guide}`} className="hover:text-accent">
                      {m.name}
                    </Link>
                  ) : (
                    m.name
                  )}
                </span>
                <span className="col-start-1 row-start-2 flex flex-wrap gap-1.5 sm:col-start-auto sm:row-start-auto">
                  {m.modes.map((mode) => (
                    <span
                      key={mode}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        m.live ? "border-line text-text" : "border-border text-muted"
                      }`}
                    >
                      {t.models.modes[mode]}
                    </span>
                  ))}
                </span>
                <span
                  className={`row-span-2 text-right font-mono text-xs sm:row-span-1 ${m.live ? "text-accent" : "text-faint"}`}
                >
                  {m.live ? `● ${t.models.live}` : `○ ${t.models.soon}`}
                </span>
              </li>
            ))}
            <li className="py-6 text-2xl font-semibold tracking-tight text-faint sm:text-3xl">
              + {t.models.more}
            </li>
          </ul>
        </div>
      </section>

      {/* 마무리 */}
      <section className="overflow-hidden bg-text text-bg">
        <div className="mx-auto w-full max-w-6xl px-4 pt-20 pb-14">
          <p aria-hidden className="text-[26vw] leading-[0.85] font-bold tracking-[-0.06em] sm:text-[13rem]">
            <span className="home-flow inline-block pr-[0.1em] pb-[0.05em]">E2P</span>
            <span className="-ml-[0.1em] text-accent">.</span>
          </p>
          <div className="mt-10 flex flex-col gap-6 border-t border-bg/15 pt-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t.finalTitle}</h2>
            </div>
            <Link href="/generate" className="btn shrink-0 bg-bg px-6 py-3 text-text hover:bg-accent hover:text-accent-fg">
              {t.cta} <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>
      <p className="sr-only">{SITE.expansion}</p>
    </main>
  );
}

function StageLabel({ n, text }: { n: number; text: string }) {
  return (
    <figcaption className="mb-3 flex items-baseline gap-2">
      <span className="font-mono text-xs text-accent">0{n}</span>
      <span className="font-semibold">{text}</span>
    </figcaption>
  );
}

function Arrow() {
  return (
    <span aria-hidden className="grid place-items-center py-1 font-mono text-xl text-accent lg:pt-8">
      <span className="lg:hidden">↓</span>
      <span className="hidden lg:inline">→</span>
    </span>
  );
}

/** 파일을 넣기 전 자리 표시 */
function Slot({ text, hint, play }: { text: string; hint: string; play?: boolean }) {
  return (
    <div className="home-hatch flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
      {play && (
        <span className="grid size-12 place-items-center rounded-full border border-line bg-bg text-sm">▶</span>
      )}
      <span className="rounded bg-bg px-2 py-0.5 text-sm font-medium">{text}</span>
      <span className="rounded bg-bg px-2 py-0.5 font-mono text-[10px] text-faint">{hint}</span>
    </div>
  );
}
