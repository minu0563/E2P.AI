"use client";

import { usePathname } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/i18n/config";

/** /ko/... · /en/... 로 이동하면 proxy가 쿠키에 저장하고 같은 페이지(언어 없는 주소)로 돌려보낸다 */
export function LangSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const rest = pathname.replace(/^\/(ko|en)(?=\/|$)/, "") || "";
  return (
    <div className="text-sm">
      <p className="label mb-2">{label}</p>
      <div className="flex gap-3">
        {LOCALES.map((l) => (
          <a
            key={l}
            href={`/${l}${rest}`}
            aria-current={l === locale ? "true" : undefined}
            className={l === locale ? "font-medium text-text underline decoration-accent underline-offset-4" : "text-muted hover:text-text"}
          >
            {l === "ko" ? "한국어" : "English"}
          </a>
        ))}
      </div>
    </div>
  );
}
