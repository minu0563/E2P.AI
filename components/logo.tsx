/** E2P.AI 워드마크 — 모노 서체, 점 하나만 강조색 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={`font-mono font-bold tracking-tight text-text ${size === "lg" ? "text-3xl" : "text-[18px]"}`}
    >
      E2P<span className="text-accent">.</span>AI
    </span>
  );
}
