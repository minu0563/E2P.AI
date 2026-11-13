import { fmt, getDictionary } from "@/lib/i18n";

export async function DocPage({
  title,
  updated,
  draft,
  lead,
  children,
}: {
  title: string;
  updated?: string;
  /** 법률 문서 초안 표시 (변호사 검토 전) */
  draft?: boolean;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = (await getDictionary()).doc;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16">
      <div className="grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="md:pt-3">
          {updated && <p className="label">{fmt(t.updated, { date: updated })}</p>}
        </div>
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-[-0.035em] sm:text-5xl">{title}</h1>
          {lead && <p className="mt-4 text-lg leading-relaxed text-muted">{lead}</p>}
          {draft && <p className="mt-6 border-l-2 border-warn bg-warn-soft px-4 py-2.5 text-sm text-warn">{t.draft}</p>}
          <article className="prose-doc mt-10">{children}</article>
        </div>
      </div>
    </main>
  );
}
