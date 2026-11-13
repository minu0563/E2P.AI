import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AccountMenu } from "@/components/account-menu";
import { LangSwitch } from "@/components/lang-switch";
import { Logo } from "@/components/logo";
import { getDictionary, getLocale } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/config";
import { FOOTER_LINKS, NAV, SITE } from "@/lib/site";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: { default: `${SITE.name} — ${SITE.expansion}`, template: `%s · ${SITE.name}` },
    description: t.meta.description,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const t = await getDictionary();
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:gap-10">
            <Link href="/" aria-label={SITE.name} className="shrink-0">
              <Logo />
            </Link>
            <nav className="flex gap-4 text-sm sm:gap-6">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-muted transition hover:text-text">
                  {t.nav[n.key]}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <Suspense fallback={<span className="block h-8 w-16" />}>
                <AccountMenu t={t.account} />
              </Suspense>
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 text-sm">
            <div className="grid gap-10 sm:grid-cols-[1.2fr_1fr_auto]">
              <div>
                <Logo />
                <p className="mt-3 max-w-xs text-muted">{SITE.slogan}</p>
              </div>
              <nav className="grid grid-cols-2 content-start gap-x-6 gap-y-2 text-muted">
                {FOOTER_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="hover:text-text">
                    {t.footer[l.key]}
                  </Link>
                ))}
              </nav>
              <LangSwitch locale={locale} label={t.footer.language} />
            </div>
            <div className="mt-10 flex flex-col justify-between gap-2 border-t border-border pt-5 text-xs text-faint sm:flex-row">
              <p>{t.footer.tagline}</p>
              <p className="font-mono">© {SITE.name}</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
