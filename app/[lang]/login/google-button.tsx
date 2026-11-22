"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries/ko";

type TurnstileApi = {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** 봇 방지(Cloudflare Turnstile) 위젯. 확인되면 onToken(값), 만료·오류면 onToken(null) */
function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (v: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const mount = useCallback(() => {
    if (!box.current || !window.turnstile) return;
    return window.turnstile.render(box.current, {
      sitekey: siteKey,
      action: "login",
      callback: (v: string) => onToken(v),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
  }, [siteKey, onToken]);
  useEffect(() => {
    if (!loaded) return;
    const id = mount();
    return () => {
      if (id) window.turnstile?.remove(id);
    };
  }, [loaded, mount]);
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
      />
      <div ref={box} className="flex min-h-[65px] justify-center" />
    </>
  );
}

export function GoogleButton({ next, t, siteKey }: { next?: string; t: Dictionary["login"]; siteKey?: string | null }) {
  // 사이트 키가 없으면(로컬 개발) 봇 방지 없이 진행
  const [token, setToken] = useState<string | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  // 이미지 보관 동의는 따로 체크한다 (무엇을 얼마나 보관하는지 분명히 알리고 받기). 둘 다 같은 약관 버전으로 기록된다
  const [agreeImages, setAgreeImages] = useState(false);
  const agree = agreeTerms && agreeImages && (!siteKey || !!token);
  const href = `/auth/google?agree=1${next ? `&next=${encodeURIComponent(next)}` : ""}${
    token ? `&ts=${encodeURIComponent(token)}` : ""
  }`;
  const link = (href: string, label: string) => (
    <a href={href} target="_blank" className="text-text underline decoration-faint underline-offset-2 hover:decoration-accent">
      {label}
    </a>
  );
  return (
    <div className="mt-9 flex flex-col gap-4 text-left">
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted">
        <input
          type="checkbox"
          checked={agreeTerms}
          onChange={(e) => setAgreeTerms(e.target.checked)}
          className="mt-[3px] size-4 shrink-0 accent-accent"
        />
        <span>
          {t.agree1}
          {link("/terms", t.terms)}, {link("/privacy", t.privacy)}, {link("/policy", t.policy)}
          {t.agreeTail}
        </span>
      </label>

      <div className="text-[13px] leading-relaxed text-muted">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={agreeImages}
            onChange={(e) => setAgreeImages(e.target.checked)}
            className="mt-[3px] size-4 shrink-0 accent-accent"
          />
          <span>{t.imageAgree}</span>
        </label>
        <details className="mt-1 ml-[26px]">
          <summary className="cursor-pointer text-xs text-faint hover:text-text">{t.imageMore}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
            {t.imageDetails.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </div>

      {siteKey && <Turnstile siteKey={siteKey} onToken={setToken} />}

      {/* Google 표준 버튼 모양: 흰 바탕 + 로고 */}
      <a
        href={agree ? href : undefined}
        aria-disabled={!agree}
        className={`flex h-11 items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white text-sm font-medium text-[#1f1f1f] transition ${
          agree ? "hover:bg-[#f7f8f8] hover:shadow-sm" : "pointer-events-none opacity-40"
        }`}
      >
        <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-4 7-9.8 7-17.1z" />
          <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
        </svg>
        {t.button}
      </a>
    </div>
  );
}
