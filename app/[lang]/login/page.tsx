import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDictionary } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { turnstileSiteKey } from "@/lib/turnstile";
import { GoogleButton } from "./google-button";
import "./login.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).account.login };
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const dict = await getDictionary();
  const t = dict.login;
  return (
    <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden className="login-backdrop absolute inset-0" />

      <div className="relative w-full max-w-[360px]">
        <div className="text-center">
          <h1 className="sr-only">{t.title}</h1>

          {/* 자간을 좁히면 마지막 글자(P)가 잘려서 글자 칸에 여유를 준다 */}
          <p aria-hidden className="text-[5rem] leading-[1.1] font-bold">
            <span className="login-flow inline-block pr-[0.12em] pb-[0.06em] tracking-[-0.05em]">E2P</span>
            <span className="-ml-[0.12em] text-accent">.</span>
          </p>
          <p className="mt-2 font-mono text-[11px] tracking-[0.32em] text-muted">EVERYTHING TO PROMPT</p>

          <p className="mt-8 text-lg font-semibold tracking-tight">{SITE.tagline}</p>
          <p className="mt-1 text-sm text-muted">
            {SITE.slogan} <b className="font-mono font-semibold text-text">{SITE.short}</b>
          </p>

          <div aria-hidden className="mx-auto mt-9 h-px w-12 bg-border" />

          {/* 쿼리(error, next)를 읽는 부분만 동적으로 */}
          <Suspense fallback={<GoogleButton t={t} />}>
            <LoginActions searchParams={searchParams} t={t} />
          </Suspense>
        </div>

        <p className="mt-8 text-center text-xs text-faint">
          <Link href="/faq" className="hover:text-text">
            {dict.nav.faq}
          </Link>
          <span className="mx-2">·</span>
          <Link href="/contact" className="hover:text-text">
            {dict.footer.contact}
          </Link>
        </p>
      </div>
    </main>
  );
}

async function LoginActions({
  searchParams,
  t,
}: {
  searchParams: PageProps<"/[lang]/login">["searchParams"];
  t: Awaited<ReturnType<typeof getDictionary>>["login"];
}) {
  const { error, next } = await searchParams;
  const message = typeof error === "string" ? t.errors[error] : undefined;
  return (
    <>
      {message && (
        <p role="alert" className="mt-6 rounded-md bg-danger-soft px-3 py-2 text-left text-sm text-danger">
          {message}
        </p>
      )}
      <GoogleButton next={typeof next === "string" ? next : undefined} t={t} siteKey={turnstileSiteKey()} />
    </>
  );
}
