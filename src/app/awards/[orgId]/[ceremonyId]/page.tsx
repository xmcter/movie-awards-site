import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCeremony,
  getOrg,
  getFilm,
  ceremonies,
  groupNominationsByCategory,
} from "@/lib/data";
import { AwardBadge } from "@/components/Badge";
import { formatDate } from "@/lib/labels";

interface Props {
  params: Promise<{ orgId: string; ceremonyId: string }>;
}

export async function generateStaticParams() {
  return ceremonies.map((c) => ({
    orgId: c.orgId,
    ceremonyId: c.id,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ceremonyId } = await params;
  const ceremony = getCeremony(ceremonyId);
  return { title: ceremony?.name || "典礼" };
}

export default async function CeremonyPage({ params }: Props) {
  const { orgId, ceremonyId } = await params;
  const ceremony = getCeremony(ceremonyId);
  const org = getOrg(orgId);
  if (!ceremony || !org || ceremony.orgId !== orgId) notFound();

  const categories = groupNominationsByCategory(ceremony);

  return (
    <div>
      <nav className="mb-4 text-sm text-cinema-muted">
        <Link href="/awards" className="hover:text-cinema-gold">
          奖项
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/awards/${orgId}`} className="hover:text-cinema-gold">
          {org.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-cinema-text">{ceremony.year}</span>
      </nav>

      <div
        className="mb-2 h-1.5 w-16 rounded-full"
        style={{ backgroundColor: org.accentColor }}
      />
      <h1 className="font-display text-3xl text-cinema-text">{ceremony.name}</h1>
      {ceremony.nameEn && (
        <p className="mt-1 text-cinema-muted">{ceremony.nameEn}</p>
      )}
      <p className="mt-3 text-sm text-cinema-muted">
        {ceremony.location || org.country}
        {ceremony.date ? ` · ${formatDate(ceremony.date)}` : ""}
      </p>

      <div className="mt-10 space-y-8">
        {categories.map((cat) => (
          <section key={cat.categoryId}>
            <h2 className="mb-3 border-b border-cinema-border pb-2 font-display text-lg text-cinema-gold">
              {cat.categoryName}
            </h2>
            <ul className="space-y-2">
              {cat.items
                .slice()
                .sort((a, b) => (a.result === "won" ? -1 : b.result === "won" ? 1 : 0))
                .map((nom, i) => {
                  const film = getFilm(nom.filmId);
                  return (
                    <li
                      key={`${nom.filmId}-${i}`}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 ${
                        nom.result === "won"
                          ? "border border-cinema-gold/30 bg-cinema-gold/5"
                          : "border border-cinema-border bg-cinema-card"
                      }`}
                    >
                      <div>
                        {film ? (
                          <Link
                            href={`/films/${film.id}`}
                            className="font-medium text-cinema-text hover:text-cinema-gold-light"
                          >
                            {film.title}
                          </Link>
                        ) : (
                          <span className="text-cinema-muted">{nom.filmId}</span>
                        )}
                        {nom.personNames && nom.personNames.length > 0 && (
                          <p className="mt-0.5 text-sm text-cinema-muted">
                            {nom.personNames.join("、")}
                          </p>
                        )}
                      </div>
                      <AwardBadge result={nom.result} />
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
