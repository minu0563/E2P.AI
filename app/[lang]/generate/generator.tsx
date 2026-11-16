"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HistoryItem } from "@/lib/history";
import type { Dictionary } from "@/lib/i18n/dictionaries/ko";
import { fmt, fmtDate } from "@/lib/i18n/format";
import type { FieldKey, Pace, Profile } from "@/lib/profile";
import { ImageDrop } from "./image-drop";
import { ResultPanel, type Progress, type Result } from "./result-panel";

type Props = {
  profileId: string;
  fields: Profile["fields"];
  groups: Profile["groups"];
  paces: Profile["paces"];
  duration: Profile["duration"];
  aspectRatios: string[];
  placeholder: string;
  placeholderEnabled: boolean;
  limits: { max_source_bytes: number; max_image_side: number; max_request_chars: number; max_field_chars: number };
  locale: string;
  t: Dictionary["generator"];
  tr: Dictionary["result"];
  te: Dictionary["errors"];
  outcomes: Record<string, string>;
};

type InputMode = "natural" | "fields";

const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-line";

export function Generator({
  profileId,
  fields,
  groups,
  paces,
  duration: durationSpec,
  aspectRatios,
  placeholder,
  placeholderEnabled,
  limits,
  locale,
  t,
  tr,
  te,
  outcomes,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(durationSpec.default);
  const [aspectRatio, setAspectRatio] = useState("");
  const [pace, setPace] = useState<Pace>("normal");
  const [mode, setMode] = useState<InputMode>("natural");
  const [request, setRequest] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [usePlaceholder, setUsePlaceholder] = useState(false);
  const [autoFilled, setAutoFilled] = useState<Partial<Record<FieldKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loadedNote, setLoadedNote] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const jobRef = useRef<string | null>(null);

  /** 취소: 서버 작업도 취소(크레딧 반환)하고 기다리기를 멈춘다 */
  function cancel() {
    const id = jobRef.current;
    if (id) fetch(`/api/generate/${id}`, { method: "DELETE" }).catch(() => {});
    abortRef.current?.abort();
  }
  const router = useRouter();

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [loading]);

  /** 기록 하나를 입력칸·결과에 되살린다 */
  function applyHistory(item: HistoryItem) {
    const i = item.input;
    if (i) {
      setMode(i.inputMode);
      setRequest(i.request ?? "");
      setValues({ ...i.fields });
      setPace(i.pace ?? "normal");
      setDuration(i.duration ?? durationSpec.default);
      setAspectRatio(i.aspectRatio ?? "");
      setUsePlaceholder(!!i.placeholder);
    } else {
      setMode("natural");
      setRequest(item.requestText);
    }
    setAutoFilled({});
    setResult(
      item.prompt
        ? {
            ok: true,
            requestId: item.id,
            prompt: item.prompt,
            filled: {},
            notices: [],
            meta: { shot_type: "", viewpoint: "" },
            timings: { totalMs: 0 },
            loaded: true,
          }
        : null,
    );
    setLoadedNote(fmt(t.loaded, { date: fmtDate(item.createdAt, locale) }));
    setHistoryOpen(false);
  }

  // /generate?load=요청ID (내 계정 페이지에서 '열기')
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("load");
    if (!id) return;
    fetch(`/api/history?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; items?: HistoryItem[] }) => {
        if (d.ok && d.items?.[0]) applyHistory(d.items[0]);
      })
      .catch(() => {});
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만
  }, []);

  function reset() {
    setRequest("");
    setValues({});
    setUsePlaceholder(false);
    setPace("normal");
    setDuration(durationSpec.default);
    setAspectRatio("");
    setAutoFilled({});
    setResult(null);
    setLoadedNote(null);
  }

  const canSubmit = !!file && !loading && (mode === "fields" || usePlaceholder || request.trim().length > 0);

  async function submit() {
    if (!file || loading) return;
    setLoading(true);
    setElapsed(0);
    setResult(null);
    setLoadedNote(null);
    const form = new FormData();
    form.set("image", file);
    form.set("profile", profileId);
    form.set("inputMode", mode);
    form.set("request", request);
    form.set("duration", String(duration));
    form.set("aspectRatio", aspectRatio);
    form.set("pace", pace);
    if (usePlaceholder) form.set("placeholder", "on");
    if (mode === "fields") {
      for (const f of fields) form.set(`field.${f.key}`, values[f.key] ?? "");
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setProgress(null);
    try {
      // 1) 큐에 등록 → 2) 끝날 때까지 상태 확인
      const res = await fetch("/api/generate", { method: "POST", body: form, signal: ac.signal });
      const queued = (await res.json()) as Result | { ok: true; queued: true; jobId: string };
      let data: Result;
      if ("queued" in queued) {
        jobRef.current = queued.jobId;
        const done = await waitForJob(queued.jobId, ac.signal, setProgress);
        if (!done || ("code" in done && done.code === "CANCELLED")) return;
        data = done as Result;
      } else {
        data = queued;
      }
      // 서버 메시지 대신 현재 언어의 문구로
      if (!data.ok && te[data.code]) data.message = te[data.code];
      setResult(data);
      if (data.ok) setAutoFilled(data.filled);
      router.refresh(); // 헤더 크레딧 잔액 갱신
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setResult({ ok: false, code: "SYSTEM_ERROR", message: t.serverDown });
      }
    } finally {
      setLoading(false);
      setProgress(null);
      jobRef.current = null;
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="relative">
        {/* 새로 시작 · 기록 */}
        <div className="mb-5 flex items-center justify-end">
          <div className="flex items-center gap-4 text-sm">
            <button onClick={reset} className="text-muted hover:text-text">
              {t.newPrompt}
            </button>
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              aria-expanded={historyOpen}
              className={`font-medium ${historyOpen ? "text-accent" : "text-text hover:text-accent"}`}
            >
              {t.history} ▾
            </button>
          </div>
        </div>

        {historyOpen && (
          <HistoryPanel
            t={t}
            locale={locale}
            outcomes={outcomes}
            onPick={applyHistory}
            onClose={() => setHistoryOpen(false)}
          />
        )}

        <div className="flex flex-col gap-7">
          {loadedNote && (
            <p className="border-l-2 border-accent bg-accent-soft px-3 py-2 text-xs leading-relaxed text-text">{loadedNote}</p>
          )}

          <div>
            <Label step={1}>{t.image}</Label>
            <ImageDrop
              file={file}
              maxBytes={limits.max_source_bytes}
              maxSide={limits.max_image_side}
              t={t}
              onChange={(f) => {
                setFile(f);
                setAutoFilled({});
              }}
            />
          </div>

          <div>
            <Label step={2}>
              {t.motion}
              <Help label={t.helpLabel}>{mode === "natural" ? t.helpNatural : t.helpFields}</Help>
            </Label>
            <div role="tablist" className="mb-3 flex gap-5 border-b border-border text-sm">
              {(
                [
                  ["natural", t.tabNatural],
                  ["fields", t.tabFields],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`-mb-px border-b-2 pb-2 transition ${
                    mode === m ? "border-line font-semibold text-text" : "border-transparent text-muted hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              maxLength={limits.max_request_chars}
              rows={3}
              placeholder={mode === "natural" ? t.naturalPlaceholder : t.fieldsPlaceholder}
              className={`${inputCls} resize-none py-2.5`}
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {mode === "natural" ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {t.examples.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setRequest(ex)}
                      className="text-xs text-muted underline decoration-border underline-offset-2 hover:text-text hover:decoration-accent"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <span className="shrink-0 font-mono text-[11px] text-faint tabular-nums">
                {request.length}/{limits.max_request_chars}
              </span>
            </div>

            {mode === "fields" && (
              <div className="mt-4 border-t border-border">
                {groups.map((g) => {
                  const gf = fields.filter((f) => f.group === g.key);
                  const filledCount = gf.filter((f) => values[f.key]?.trim()).length;
                  return (
                    <details key={g.key} open={g.open} className="group border-b border-border">
                      <summary className="flex cursor-pointer list-none items-center justify-between py-2.5 text-sm font-medium select-none">
                        <span>{t.groups[g.key] ?? g.label}</span>
                        <span className="flex items-center gap-3 font-mono text-[11px] font-normal text-faint">
                          {filledCount > 0 && <span className="text-accent">{fmt(t.filledCount, { n: filledCount })}</span>}
                          <span className="transition group-open:rotate-45">+</span>
                        </span>
                      </summary>
                      <div className="grid gap-3 pb-4 sm:grid-cols-2">
                        {gf.map((f) => {
                          const isKey = f.key === "key_action";
                          const disabled = isKey && usePlaceholder;
                          const tf = t.fields[f.key] ?? { label: f.label, hint: f.hint };
                          return (
                            <label key={f.key} className={isKey ? "sm:col-span-2" : ""}>
                              <span className="mb-1 block text-xs text-muted">{tf.label}</span>
                              {isKey ? (
                                <textarea
                                  rows={2}
                                  value={disabled ? "" : (values[f.key] ?? "")}
                                  disabled={disabled}
                                  maxLength={limits.max_field_chars}
                                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                                  placeholder={disabled ? placeholder : (autoFilled[f.key] ?? tf.hint)}
                                  className={`${inputCls} resize-none disabled:bg-surface-2 disabled:placeholder:font-mono`}
                                />
                              ) : (
                                <input
                                  value={values[f.key] ?? ""}
                                  maxLength={limits.max_field_chars}
                                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                                  placeholder={autoFilled[f.key] ?? tf.hint}
                                  className={inputCls}
                                />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label step={3}>
              {t.pace}
              <Help label={t.helpLabel}>{t.helpPace}</Help>
            </Label>
            <div role="radiogroup" className="grid grid-cols-3 border border-border text-sm">
              {paces.map((p, i) => (
                <button
                  key={p.key}
                  role="radio"
                  aria-checked={pace === p.key}
                  onClick={() => setPace(p.key)}
                  className={`py-2 transition ${i ? "border-l border-border" : ""} ${
                    pace === p.key ? "bg-text font-semibold text-bg" : "text-muted hover:text-text"
                  }`}
                >
                  {t.paces[p.key] ?? p.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-xs text-muted">{t.duration}</span>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls}>
                  {Array.from({ length: durationSpec.max - durationSpec.min + 1 }, (_, i) => durationSpec.min + i).map((s) => (
                    <option key={s} value={s}>
                      {fmt(t.seconds, { n: s })}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-muted">{t.aspect}</span>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className={inputCls}>
                  <option value="">{t.aspectNone}</option>
                  {aspectRatios.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {placeholderEnabled && (
            <div className="flex items-center gap-2 border-t border-border pt-4 text-sm">
              <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={usePlaceholder}
                  onChange={(e) => setUsePlaceholder(e.target.checked)}
                  className="size-4 accent-accent"
                />
                <span>{t.placeholderToggle}</span>
              </label>
              <Help label={t.helpLabel} align="right">
                {fmt(t.helpPlaceholder, { ph: placeholder })}
              </Help>
            </div>
          )}
        </div>

        <div className="mt-7 flex items-center gap-2">
          <button onClick={submit} disabled={!canSubmit} className="btn btn-primary flex-1 py-3">
            {loading ? fmt(t.generating, { n: elapsed }) : t.submit}
          </button>
          {loading && (
            <button onClick={cancel} className="btn btn-ghost py-3">
              {t.cancel}
            </button>
          )}
        </div>
        {!file && <p className="mt-2 text-xs text-faint">{t.needImage}</p>}
      </section>

      <ResultPanel result={result} loading={loading} elapsed={elapsed} progress={progress} onRegenerate={submit} canRegenerate={!!file} t={tr} />
    </div>
  );
}

function HistoryPanel({
  t,
  locale,
  outcomes,
  onPick,
  onClose,
}: {
  t: Dictionary["generator"];
  locale: string;
  outcomes: Record<string, string>;
  onPick: (item: HistoryItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    fetch("/api/history")
      .then(async (r) => {
        if (r.status === 401) return setNeedLogin(true);
        const d = (await r.json()) as { items: HistoryItem[] };
        setItems(d.items);
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="absolute inset-x-0 top-9 z-20 max-h-[70vh] overflow-auto rounded-md border border-border bg-surface shadow-lg shadow-black/5">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="text-sm font-semibold">{t.historyTitle}</p>
        <button onClick={onClose} className="text-xs text-muted hover:text-text">
          {t.close}
        </button>
      </div>
      {needLogin ? (
        <p className="px-4 py-6 text-sm text-muted">{t.historyLogin}</p>
      ) : items === null ? (
        <p className="px-4 py-6 font-mono text-xs text-faint">…</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{t.historyEmpty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => {
            const summary =
              it.requestText || it.input?.fields?.key_action || Object.values(it.input?.fields ?? {})[0] || "—";
            return (
              <li key={it.id}>
                <button
                  onClick={() => onPick(it)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{summary}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-faint">
                      {fmtDate(it.createdAt, locale)} · {outcomes[it.outcome] ?? it.outcome}
                      {it.input && ` · ${it.input.duration}s · ${it.input.pace}`}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-accent">{t.historyLoad} →</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** ? 버튼을 누르면 설명이 열린다. 바깥을 누르거나 Esc로 닫힘 */
function Help({
  children,
  label,
  align = "left",
}: {
  children: React.ReactNode;
  label: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative ml-1.5 inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={`grid size-4 place-items-center rounded-full border font-mono text-[10px] leading-none transition ${
          open ? "border-line bg-text text-bg" : "border-border text-faint hover:border-line hover:text-text"
        }`}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute top-6 z-30 w-72 border border-line bg-surface p-3 text-xs leading-relaxed font-normal text-muted ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}

function Label({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
      <span className="font-mono text-xs font-normal text-accent">0{step}</span>
      {children}
    </h2>
  );
}

/** 작업이 끝날 때까지 1초마다 상태를 확인한다. 취소되면 null */
async function waitForJob(
  id: string,
  signal: AbortSignal,
  onProgress: (p: Progress) => void,
): Promise<Result | { ok: false; code: "CANCELLED" } | null> {
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, 1000));
    if (signal.aborted) return null;
    const res = await fetch(`/api/generate/${id}`, { signal, cache: "no-store" });
    if (res.status === 404) throw new Error("job gone");
    const s = (await res.json()) as
      | { status: "queued"; position: number }
      | { status: "active"; stage: "analyzing" | "writing" }
      | { status: "done"; result: Result };
    if (s.status === "done") return s.result;
    onProgress(s);
  }
  return null;
}
