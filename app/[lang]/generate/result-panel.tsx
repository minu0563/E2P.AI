"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries/ko";
import type { FieldKey } from "@/lib/profile";

export type Result =
  | {
      ok: true;
      requestId: string;
      prompt: string;
      filled: Partial<Record<FieldKey, string>>;
      notices: string[];
      meta: { shot_type: string; viewpoint: string };
      timings: { totalMs: number };
      debug?: string[];
      /** 기록에서 불러온 결과 */
      loaded?: boolean;
    }
  | {
      ok: false;
      requestId?: string;
      code: string;
      message: string;
      debug?: string[];
      /** 차단 크레딧 안내: 이번에 차감됨 / 다음부터 차감됨 */
      creditNotice?: "blockFee" | "blockWarn" | null;
    };

const APPEALABLE = ["AGE_UNCERTAIN", "SEXUAL_IMAGE", "SEXUAL_REQUEST", "THIRD_PARTY_CLAIM"];

/** 개발 모드에서만 서버가 debug를 보낸다 */
function DebugBox({ lines, title }: { lines?: string[]; title: string }) {
  if (!lines?.length) return null;
  return (
    <details open className="mt-3 border border-dashed border-border p-3 text-xs text-muted">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <ul className="mt-2 space-y-0.5 font-mono">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </details>
  );
}

function sendFeedback(requestId: string, kind: "copy" | "like" | "dislike") {
  fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, kind }),
  }).catch(() => {});
}

export function ResultPanel({
  result,
  loading,
  elapsed,
  onRegenerate,
  canRegenerate,
  t,
}: {
  result: Result | null;
  loading: boolean;
  elapsed: number;
  onRegenerate: () => void;
  canRegenerate: boolean;
  t: Dictionary["result"];
}) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [lastId, setLastId] = useState<string | undefined>();

  // 새 결과가 오면 상태 초기화
  if (result?.requestId !== lastId) {
    setLastId(result?.requestId);
    setCopied(false);
    setVote(null);
  }

  const [appealBefore, appealAfter] = t.appeal.split("{link}");

  return (
    <section className="flex min-h-96 flex-col rounded-md bg-surface lg:sticky lg:top-20 lg:mt-11 lg:self-start">
      <div className="flex flex-1 flex-col p-5">
        {loading && (
          <div className="flex flex-1 flex-col justify-center gap-2 py-14 font-mono text-sm text-muted">
            <p>
              {elapsed < 4 ? t.analyzing : t.writing}
              <span className="animate-pulse">▍</span>
            </p>
            <p className="text-xs text-faint tabular-nums">{elapsed}s</p>
          </div>
        )}

        {!loading && !result && (
          <div className="flex flex-1 items-center py-14 text-sm whitespace-pre-line text-faint">{t.empty}</div>
        )}

        {!loading && result && !result.ok && (
          <div className="border-l-2 border-danger bg-danger-soft p-4 text-sm text-danger">
            <p>{result.message}</p>
            {result.creditNotice && (
              <p className="mt-2 text-xs font-medium">{t[result.creditNotice]}</p>
            )}
            {result.code === "LOGIN_REQUIRED" && (
              <Link href="/login?next=/generate" className="btn btn-primary mt-3 px-3 py-1.5 text-xs">
                {t.loginCta}
              </Link>
            )}
            {APPEALABLE.includes(result.code) && (
              <p className="mt-2 text-xs opacity-80">
                {appealBefore}
                <Link href="/contact" className="underline">
                  {t.appealLink}
                </Link>
                {appealAfter}
              </p>
            )}
            <DebugBox lines={result.debug} title={t.debug} />
          </div>
        )}

        {!loading && result?.ok && (
          <div className="flex flex-col gap-3">
            {result.notices.length > 0 && (
              <p className="border-l-2 border-warn bg-warn-soft px-3 py-2 text-xs text-warn">{t.neutralized}</p>
            )}

            <pre className="max-h-[30rem] overflow-auto border-l-2 border-accent bg-bg p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {result.prompt}
            </pre>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(result.prompt);
                  setCopied(true);
                  sendFeedback(result.requestId, "copy");
                }}
                className="btn btn-primary"
              >
                {copied ? t.copied : t.copy}
              </button>
              <button onClick={onRegenerate} disabled={!canRegenerate} className="btn btn-ghost disabled:opacity-40">
                {t.regenerate}
              </button>
              {!result.loaded && (
                <div className="ml-auto flex items-center gap-1 text-xs text-muted">
                  <span className="mr-1">{t.rate}</span>
                  {(["like", "dislike"] as const).map((k) => (
                    <button
                      key={k}
                      aria-pressed={vote === k}
                      aria-label={k === "like" ? t.like : t.dislike}
                      onClick={() => {
                        if (vote) return;
                        setVote(k);
                        sendFeedback(result.requestId, k);
                      }}
                      className={`rounded-md border px-2 py-1 ${
                        vote === k ? "border-line bg-text text-bg" : "border-border hover:border-line"
                      } ${vote && vote !== k ? "opacity-40" : ""}`}
                    >
                      {k === "like" ? "👍" : "👎"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!result.loaded && (
              <p className="font-mono text-[11px] text-faint">
                {t.analyzed}: {t.shot[result.meta.shot_type] ?? "-"} · {t.view[result.meta.viewpoint] ?? "-"} ·{" "}
                {(result.timings.totalMs / 1000).toFixed(1)}s
              </p>
            )}
            <DebugBox lines={result.debug} title={t.debug} />
          </div>
        )}
      </div>
    </section>
  );
}
