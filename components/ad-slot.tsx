"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import ads from "@/config/ads.json";

type Placement = keyof typeof ads.slots;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 애드센스 광고 한 칸. 랜딩·가이드·FAQ 하단과 생성기 화면 맨 아래에만 넣는다(로그인·내 계정·문의 화면 금지 — CLAUDE.md 13장).
 * 생성기 칸은 버튼에서 떨어진 맨 아래에 고정, 생성할 때마다 새로 고치지 않는다(애드센스 정책).
 * 스크립트도 이 칸이 있는 페이지에서만 불러온다(레이아웃 전체에 넣지 않음). 꺼져 있거나 번호가 없으면 아무것도 그리지 않는다.
 */
export function AdSlot({ placement, className = "" }: { placement: Placement; className?: string }) {
  const slot = ads.slots[placement];
  const pushed = useRef(false);
  const on = ads.enabled && !!ads.client && !!slot;

  useEffect(() => {
    if (!on || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* 광고 차단기 등 */
    }
  }, [on]);

  if (!on) return null;
  return (
    <div className={`my-10 ${className}`} aria-label="advertisement">
      <Script
        id="adsense"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle block"
        data-ad-client={ads.client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
