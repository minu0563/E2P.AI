import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import type { Dictionary } from "@/lib/i18n";

/** 헤더 오른쪽: 로그인 버튼 또는 크레딧 잔액 + 내 계정 (세션을 읽으므로 Suspense 안에서 렌더) */
export async function AccountMenu({ t }: { t: Dictionary["account"] }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="btn btn-primary px-3.5 py-1.5">
        {t.login}
      </Link>
    );
  }
  const { total } = await getBalance(user.id);
  return (
    <Link href="/me" title={t.myAccount} className="flex items-center gap-3 text-sm text-muted hover:text-text">
      <span className="hidden font-mono text-xs sm:inline">
        {t.credits} <b className="font-semibold text-text tabular-nums">{compact(total)}</b>
      </span>
      <span className="grid size-7 place-items-center rounded-full border border-line font-mono text-xs font-semibold text-text">
        {(user.name || user.email)[0]?.toUpperCase() ?? "?"}
      </span>
    </Link>
  );
}

/** 큰 수는 줄여서 (헤더 공간) */
function compact(n: number) {
  return n >= 100_000 ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n) : String(n);
}
