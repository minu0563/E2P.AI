"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import ads from "@/config/ads.json";

type Placement = keyof typeof ads.slots;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 양옆 광고(세로 160×600)를 띄울 최소 화면 너비. 본문(max-w-6xl = 1152px) 양옆 여백(각 약 220px)에 세로 광고와 간격이 들어가는 너비.
 * 이보다 좁으면 양옆 광고 대신 맨 아래 광고 1칸.
 */
export const WIDE_QUERY = "(min-width: 1600px)";

/**
 * 애드센스 광고 한 칸 (광고 위치 규칙: CLAUDE.md 13장).
 * - media="wide": 큰 화면에서만, "narrow": 그보다 작은 화면에서만. 처음 그릴 때 한 번만 판단한다
 *   (창 크기를 바꿔도 광고를 다시 불러오지 않음 — 애드센스는 광고를 임의로 새로 고치는 것을 금지)
 * - 숨긴 광고(display:none)를 불러오지 않도록, 보일 화면에서만 칸 자체를 만든다
 * - 생성할 때마다 새로 고치지 않는다. 스크립트도 광고 칸이 있는 페이지에서만 불러온다
 * - 꺼져 있거나 번호가 없으면 아무것도 그리지 않는다
 */
export function AdSlot({
  placement,
  media,
  variant = "bottom",
  className = "",
}: {
  placement: Placement;
  media?: "wide" | "narrow";
  variant?: "bottom" | "rail";
  className?: string;
}) {
  const slot = ads.slots[placement];
  const on = ads.enabled && !!ads.client && !!slot;
  const dev = process.env.NODE_ENV === "development";
  const [visible, setVisible] = useState(!media);
  const pushed = useRef(false);

  useEffect(() => {
    if (!media) return;
    const wide = window.matchMedia(WIDE_QUERY).matches;
    // 화면 너비는 브라우저에서만 알 수 있어 첫 렌더 뒤에 한 번 정한다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(media === "wide" ? wide : !wide);
  }, [media]);

  useEffect(() => {
    if (!on || !visible || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* 광고 차단기 등 */
    }
  }, [on, visible]);

  if (!visible) return null;
  const rail = variant === "rail";

  if (!on) {
    // 개발 화면에서만: 광고가 들어갈 자리를 점선 상자로 보여 준다 (배포 빌드에는 나오지 않음)
    if (!dev) return null;
    return (
      <div className={rail ? className : `my-10 ${className}`}>
        <div
          className={`flex items-center justify-center border-2 border-dashed border-accent/60 p-2 text-center font-mono text-xs text-muted ${
            rail ? "h-[600px] w-[160px]" : "h-[120px]"
          }`}
        >
          광고 자리 (개발 미리보기) · {placement} · {rail ? "세로 160×600" : "반응형, 보통 가로 100% × 높이 90~280px"}
        </div>
      </div>
    );
  }
  return (
    <div className={rail ? className : `my-10 ${className}`} aria-label="advertisement">
      <Script
        id="adsense"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      {rail ? (
        <ins
          className="adsbygoogle"
          style={{ display: "inline-block", width: 160, height: 600 }}
          data-ad-client={ads.client}
          data-ad-slot={slot}
        />
      ) : (
        <ins
          className="adsbygoogle block"
          data-ad-client={ads.client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}

/**
 * 본문 바깥 여백의 세로 광고 (큰 화면 전용). 부모(main)에 `relative`가 있어야 한다.
 * 스크롤을 따라다니지 않는다(고정 광고는 정책 확인 전까지 쓰지 않음).
 */
export function AdRail({ side, gap = "1rem" }: { side: "left" | "right"; gap?: string }) {
  return (
    <aside
      className={`absolute top-12 hidden min-[1600px]:block ${side === "left" ? "right-full" : "left-full"}`}
      style={side === "left" ? { marginRight: gap } : { marginLeft: gap }}
    >
      <AdSlot placement="rail" variant="rail" media="wide" />
    </aside>
  );
}
