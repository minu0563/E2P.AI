"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export type SelectOption<T extends string> = { value: T; label: string };

/**
 * 직접 그리는 드롭다운 (브라우저 기본 <select>는 OS가 그려서 모바일·PC 모양을 바꿀 수 없다).
 * 키보드: ↑↓ 이동, Enter·Space 선택, Esc 닫기, Home·End, 글자 입력으로 찾기.
 * 화면 아래쪽이 좁으면 위로 연다.
 */
export function Select<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: {
  label: React.ReactNode;
  /** 라벨 옆 작은 보조 문구 */
  hint?: React.ReactNode;
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const current = options.find((o) => o.value === value) ?? options[0];

  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // 열 때: 아래 공간이 모자라면 위로, 선택된 항목이 보이게
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const need = Math.min(288, options.length * 40 + 8);
    setUp(window.innerHeight - r.bottom < need + 8 && r.top > window.innerHeight - r.bottom);
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, options.length]);

  function show() {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function pick(i: number) {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
    button.current?.focus();
  }
  function onKey(e: React.KeyboardEvent) {
    if (disabled) return;
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "ArrowDown") setActive((i) => Math.min(last, i + 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Tab") return;
    } else if (e.key.length === 1) {
      // 글자를 치면 그 글자로 시작하는 항목으로
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
      return;
    } else return;
    e.preventDefault();
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <span id={`${id}-label`} className="mb-1 block text-xs text-muted">
        {label}
        {hint && <span className="ml-1 text-faint">· {hint}</span>}
      </span>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2 text-left text-sm transition outline-none ${
          open ? "border-line" : "border-border hover:border-line"
        } focus-visible:border-line focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border`}
      >
        <span id={`${id}-value`} className="truncate">
          {current?.label}
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className={`size-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-o${active}`}
          tabIndex={-1}
          className={`absolute right-0 left-0 z-30 max-h-72 overflow-auto overscroll-contain rounded-md thin-scroll border border-border bg-surface p-1 shadow-lg shadow-black/10 ${
            up ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${id}-o${i}`}
                data-i={i}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-2 text-sm ${
                  i === active ? "bg-surface-2" : ""
                } ${selected ? "font-semibold" : ""}`}
              >
                <span>{o.label}</span>
                {selected && (
                  <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
