import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { dayStart, getBalance, grantDailyCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { fmt, fmtDate, fmtNumber, getDictionary, getLocale, type Dictionary, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).me.title };
}

export default async function MePage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-bold tracking-[-0.035em]">{dict.me.title}</h1>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse bg-surface-2" />}>
        <Account t={dict.me} logoutLabel={dict.account.logout} locale={locale} />
      </Suspense>
    </main>
  );
}

function Block({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="label">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

async function Account({ t, logoutLabel, locale }: { t: Dictionary["me"]; logoutLabel: string; locale: Locale }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const today0 = dayStart();
  await grantDailyCredits(user.id); // 오늘 무료 지급 (하루 한 번)
  const [balance, consent, today, total, blocked, entries, logs, fees] = await Promise.all([
    getBalance(user.id),
    db.consent.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.generationLog.count({ where: { userId: user.id, outcome: "ok", createdAt: { gte: today0 } } }),
    db.generationLog.count({ where: { userId: user.id, outcome: "ok" } }),
    db.generationLog.count({ where: { userId: user.id, outcome: "block" } }),
    db.creditEntry.findMany({
      where: { userId: user.id, kind: { not: "confirm" } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    // 최근 요청 (성공은 다시 열기, 모두 문의 가능)
    db.generationLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    // 차단으로 차감된 요청 (사용 내역에 "차단 차감"으로 표시)
    db.creditEntry.findMany({
      where: { userId: user.id, kind: "confirm", note: { startsWith: "block_fee:" } },
      select: { requestId: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const feeIds = new Set(fees.map((f) => f.requestId));

  // 크레딧 내역: 요청별로 예약·반환을 합쳐 실제로 바뀐 것만 보여준다 (반환되어 0이 된 요청은 숨김)
  type Row = { id: string; label: string; creditType: (typeof entries)[number]["creditType"]; amount: number; at: Date; expiresAt: Date | null };
  const rows: Row[] = [];
  const byRequest = new Map<string, Row>();
  for (const e of entries) {
    if (e.kind === "grant" || e.kind === "adjust" || !e.requestId) {
      rows.push({ id: e.id, label: t.kinds[e.kind] ?? e.kind, creditType: e.creditType, amount: e.amount, at: e.createdAt, expiresAt: e.kind === "grant" ? e.expiresAt : null });
      continue;
    }
    const r = byRequest.get(e.requestId);
    if (r) {
      r.amount += e.amount;
      if (e.createdAt < r.at) r.at = e.createdAt;
    } else {
      const row: Row = {
        id: e.requestId,
        label: feeIds.has(e.requestId) ? t.kinds.blockFee : t.kinds.reserve,
        creditType: e.creditType,
        amount: e.amount,
        at: e.createdAt,
        expiresAt: null,
      };
      byRequest.set(e.requestId, row);
      rows.push(row);
    }
  }
  const history = rows.filter((r) => r.amount !== 0).slice(0, 20);
  const d = (x: Date) => fmtDate(x, locale);
  const n = (x: number) => fmtNumber(x, locale);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
      <div className="flex flex-col gap-6">
        {/* 잔액 */}
        <section className="border border-line bg-text p-5 text-bg">
          <p className="font-mono text-[11px] tracking-widest uppercase opacity-60">{t.balance}</p>
          <p className="mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums">{n(balance.total)}</p>
          <p className="mt-2 text-xs opacity-60">
            {balance.nextExpiry ? fmt(t.nextExpiry, { date: d(balance.nextExpiry) }) : t.noExpiry}
          </p>
          <Link href="/generate" className="btn mt-5 bg-bg px-4 py-2 text-text hover:bg-accent hover:text-accent-fg">
            {t.startGenerating} →
          </Link>
        </section>

        <Block title={t.profile}>
          <dl className="divide-y divide-border text-sm">
            <Row label={t.email} value={user.email} />
            {user.name && <Row label={t.name} value={user.name} />}
            <Row label={t.signIn} value={t.google} />
            <Row label={t.joined} value={d(user.createdAt)} />
            {consent && (
              <Row label={t.consent} value={fmt(t.consentValue, { version: consent.version, date: d(consent.createdAt) })} />
            )}
          </dl>
          <form action="/auth/logout" method="post" className="mt-4">
            <button className="btn btn-ghost px-3 py-1.5 text-xs">{logoutLabel}</button>
          </form>
          <p className="mt-3 text-xs text-faint">{t.deleteAccount}</p>
        </Block>

        <Block title={t.usage}>
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            {[
              [t.today, today],
              [t.total, total],
              [t.blocked, blocked],
            ].map(([label, v]) => (
              <div key={label as string} className="px-2">
                <p className="font-mono text-2xl font-semibold tabular-nums">{n(v as number)}</p>
                <p className="mt-0.5 text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        </Block>
      </div>

      <div className="flex flex-col gap-6">
        <Block
          title={t.recent}
          right={
            <Link href="/inquiry" className="text-xs text-muted hover:text-text hover:underline">
              {t.inquiries} →
            </Link>
          }
        >
          {logs.length === 0 ? (
            <p className="text-sm text-faint">{t.recentEmpty}</p>
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {logs.map((l) => (
                <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{l.requestText || t.noRequestText}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {d(l.createdAt)} ·{" "}
                      <span className={l.outcome === "ok" ? "text-ok" : l.outcome === "block" ? "text-warn" : ""}>
                        {t.outcomes[l.outcome] ?? l.outcome}
                      </span>
                    </span>
                  </span>
                  <span className="flex gap-3">
                    {l.outcome === "ok" && l.input && (
                      <Link
                        href={`/generate?load=${l.requestId}`}
                        className="text-xs font-medium underline decoration-accent underline-offset-4 hover:text-accent"
                      >
                        {t.open}
                      </Link>
                    )}
                    <Link href={`/inquiry?id=${l.requestId}`} className="text-xs text-muted hover:text-text hover:underline">
                      {t.inquire}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title={t.history}>
          {history.length === 0 ? (
            <p className="text-sm text-faint">{t.historyEmpty}</p>
          ) : (
            <table className="-my-1 w-full text-sm">
              <tbody className="divide-y divide-border">
                {history.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-3 text-muted">{e.label}</td>
                    <td className="py-2 pr-3 text-xs text-faint">
                      {t.types[e.creditType]}
                      {e.expiresAt && ` · ${fmt(t.expires, { date: d(e.expiresAt) })}`}
                    </td>
                    <td className={`py-2 pr-3 text-right font-mono tabular-nums ${e.amount > 0 ? "text-ok" : ""}`}>
                      {e.amount > 0 ? "+" : ""}
                      {n(e.amount)}
                    </td>
                    <td className="py-2 text-right font-mono text-[11px] text-faint">{d(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Block>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
