import { fmt, getDictionary } from "@/lib/i18n";

export async function DocPage({
  title,
  updated,
  lead,
  children,
}: {
  title: string;
  updated?: string;
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
          <article className="prose-doc mt-10">{children}</article>
        </div>
      </div>
    </main>
  );
}
