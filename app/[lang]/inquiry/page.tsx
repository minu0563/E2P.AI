import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, getDictionary, getLocale } from "@/lib/i18n";
import { inquiryTarget } from "@/lib/inquiry";
import { InquiryForm } from "./inquiry-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).inquiry.title };
}

export default async function InquiryPage({ searchParams }: PageProps<"/[lang]/inquiry">) {
  const dict = await getDictionary();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold tracking-[-0.035em]">{dict.inquiry.title}</h1>
      <p className="mt-3 text-sm text-muted">{dict.inquiry.lead}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse bg-surface-2" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/[lang]/inquiry">["searchParams"] }) {
  const dict = await getDictionary();
  const locale = await getLocale();
  const t = dict.inquiry;
  const { id } = await searchParams;
  const requestId = typeof id === "string" && /^[\w-]{1,64}$/.test(id) ? id : undefined;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(requestId ? `/inquiry?id=${requestId}` : "/inquiry")}`);

  const [target, mine] = await Promise.all([
    requestId ? inquiryTarget(user.id, requestId) : null,
    db.inquiry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, requestId: true, category: true, status: true, createdAt: true, body: true },
    }),
  ]);
  const already = !!requestId && mine.some((m) => m.requestId === requestId);
  const d = (x: Date) => fmtDate(x, locale);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section className="border border-line bg-surface">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="label">{t.target}</h2>
        </div>
        <div className="p-4 text-sm">
          {target ? (
            <>
              <p>
                <span className="font-mono text-xs text-faint">{d(target.createdAt)}</span>{" "}
                <span className="font-medium">{dict.me.outcomes[target.outcome] ?? target.outcome}</span>
                {target.blockCode && dict.errors[target.blockCode] && (
                  <span className="text-muted"> · {dict.errors[target.blockCode]}</span>
                )}
              </p>
              <p className="mt-1 truncate">{target.requestText || dict.me.noRequestText}</p>
              {!target.imageAvailable && <p className="mt-2 text-xs text-warn">{t.imageExpired}</p>}
            </>
          ) : (
            <p className="text-muted">{requestId ? t.errors.NOT_FOUND : t.noTarget}</p>
          )}
        </div>
      </section>

      {already ? (
        <p className="border border-line bg-surface p-4 text-sm text-muted">{t.errors.DUPLICATE}</p>
      ) : (
        <InquiryForm t={t} requestId={target ? requestId : undefined} />
      )}
      <p className="text-xs text-faint">{t.other}</p>

      <section className="border border-line bg-surface">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="label">{t.mine}</h2>
        </div>
        <div className="p-4">
          {mine.length === 0 ? (
            <p className="text-sm text-faint">{t.mineEmpty}</p>
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {mine.map((m) => (
                <li key={m.id} className="grid grid-cols-[1fr_auto] gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{m.body}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {d(m.createdAt)} · {t.categories[m.category] ?? m.category}
                      {!m.requestId && ` · ${t.general}`}
                    </span>
                  </span>
                  <span className={`text-xs font-medium ${m.status === "done" ? "text-ok" : "text-muted"}`}>
                    {t.statuses[m.status] ?? m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
