"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries/ko";
import { fmt } from "@/lib/i18n/format";
import { resizeForUpload } from "@/lib/client-image";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ImageDrop({
  file,
  label,
  compact = false,
  maxBytes,
  maxSide,
  onChange,
  t,
}: {
  file: File | null;
  /** 칸 위 작은 이름 (시작·끝 이미지 모드) */
  label?: string;
  /** 두 칸을 나란히 놓을 때: 낮은 높이 */
  compact?: boolean;
  maxBytes: number;
  maxSide: number;
  onChange: (f: File | null) => void;
  t: Dictionary["generator"];
}) {
  const mb = Math.round(maxBytes / 1048576);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const [busy, setBusy] = useState(false);

  /** 고른 이미지를 브라우저에서 줄이고(EXIF 제거) 그 파일을 쓴다. 서버는 검증만 한다 */
  async function pick(f: File | undefined) {
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError(t.errType);
    if (f.size > maxBytes) return setError(fmt(t.errTooBig, { mb }));
    setError(null);
    setBusy(true);
    try {
      onChange(await resizeForUpload(f, maxSide));
    } catch {
      setError(t.errRead);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {label && <p className="mb-1 text-xs font-medium text-muted">{label}</p>}
      <div
        role="button"
        aria-label={label}
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={`relative grid ${compact ? "min-h-40" : "min-h-52"} cursor-pointer place-items-center overflow-hidden rounded-md border border-dashed transition ${
          drag ? "border-accent bg-accent-soft" : "border-border bg-bg hover:border-line"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기
          <img src={preview} alt="" className={`${compact ? "max-h-56" : "max-h-80"} w-full object-contain`} />
        ) : busy ? (
          <p className="p-6 text-sm text-muted">{t.preparing}</p>
        ) : (
          <div className="p-6 text-center text-sm text-muted">
            <span className="mx-auto mb-3 block font-mono text-lg text-faint">+</span>
            <p className="font-medium text-text">{t.dropTitle}</p>
            <p className="mt-1 text-xs">{fmt(t.dropFormats, { mb })}</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-faint">{t.dropNotice}</span>
        {file && (
          <button onClick={() => onChange(null)} className="shrink-0 text-muted hover:text-danger">
            {t.remove}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
