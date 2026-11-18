"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries/ko";

export function InquiryForm({ t, requestId }: { t: Dictionary["inquiry"]; requestId?: string }) {
  const router = useRouter();
  const [category, setCategory] = useState(requestId ? "appeal" : "other");
  const [body, setBody] = useState("");
  const [state, setState] = useState<{ busy?: boolean; done?: boolean; error?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, category, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string };
      if (data.ok) {
        setState({ done: true });
        setBody("");
        router.refresh();
      } else {
        setState({ error: t.errors[data.code ?? ""] ?? t.errors.default });
      }
    } catch {
      setState({ error: t.errors.default });
    }
  }

  if (state.done) return <p className="border border-line bg-surface p-4 text-sm text-ok">{t.done}</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border border-line bg-surface p-4 text-sm">
      <fieldset>
        <legend className="label mb-2">{t.category}</legend>
        <div className="flex flex-wrap gap-4">
          {Object.entries(t.categories).map(([v, label]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="category"
                value={v}
                checked={category === v}
                onChange={() => setCategory(v)}
                className="accent-accent"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="label">{t.body}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={5}
          maxLength={1000}
          rows={6}
          required
          placeholder={t.bodyPlaceholder}
          className="resize-y border border-border bg-bg p-3"
        />
        <span className="self-end font-mono text-[11px] text-faint">{body.length}/1000</span>
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={state.busy || body.trim().length < 5} className="btn btn-primary self-start px-4 py-2 disabled:opacity-50">
        {state.busy ? t.sending : t.submit}
      </button>
    </form>
  );
}
