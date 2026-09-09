import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrg, getCeremoniesByOrg, orgs } from "@/lib/data";
import { formatDate } from "@/lib/labels";

interface Props {
  params: Promise<{ orgId: string }>;
}

export async function generateStaticParams() {
  return orgs.map((o) => ({ orgId: o.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgId } = await params;
  const org = getOrg(orgId);
  return { title: org?.name || "奖项" };
}

export default async function AwardOrgPage({ params }: Props) {
  const { orgId } = await params;
  const org = getOrg(orgId);
  if (!org) notFound();

  const ceremonies = getCeremoniesByOrg(orgId);

  return (
    <div>
      <nav className="mb-4 text-sm text-cinema-muted">
        <Link href="/awards" className="hover:text-cinema-gold">
          奖项
        </Link>
        <span className="mx-2">/</span>
        <span className="text-cinema-text">{org.name}</span>
      </nav>

      <div
        className="mb-2 h-1.5 w-16 rounded-full"
        style={{ backgroundColor: org.accentColor }}
      />
      <h1 className="font-display text-3xl text-cinema-text">{org.name}</h1>
      <p className="mt-1 text-cinema-muted">{org.nameEn}</p>
      <p className="mt-4 max-w-2xl text-cinema-muted">{org.description}</p>
      <p className="mt-2 text-sm text-cinema-muted">
        {org.country}
        {org.founded ? ` · 创立于 ${org.founded}` : ""}
      </p>

      <h2 className="mt-10 font-display text-xl text-cinema-text">历届典礼</h2>
      <div className="mt-4 space-y-3">
        {ceremonies.map((c) => {
          const wins = c.nominations.filter((n) => n.result === "won").length;
          const noms = c.nominations.length;
          return (
            <Link
              key={c.id}
              href={`/awards/${orgId}/${c.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cinema-border bg-cinema-card px-5 py-4 transition hover:border-cinema-gold/40"
            >
              <div>
                <h3 className="font-medium text-cinema-text">{c.name}</h3>
                <p className="text-sm text-cinema-muted">
                  {c.location || ""}
                  {c.date ? ` · ${formatDate(c.date)}` : ` · ${c.year}年`}
                </p>
              </div>
              <p className="text-xs text-cinema-muted">
                {noms} 条纪录 · {wins} 项获奖
              </p>
            </Link>
          );
        })}
        {ceremonies.length === 0 && (
          <p className="text-cinema-muted">暂无典礼数据</p>
        )}
      </div>
    </div>
  );
}
