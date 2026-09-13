import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TypeBadge } from "@/components/Badge";
import { films, getFilm, getFilmEvents } from "@/lib/data";
import {
  PLATFORM_LABELS,
  RELEASE_STATUS_LABELS,
  formatDate,
} from "@/lib/labels";

export const dynamic = "force-static";

export function generateStaticParams() {
  return films.map((film) => ({ id: film.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const film = getFilm(id);
  if (!film) return { title: "未找到" };
  const title = film.titleEn ? `${film.title} / ${film.titleEn}` : film.title;
  return {
    title,
    description: film.synopsis,
    alternates: { canonical: `/film/${film.id}` },
    openGraph: {
      title: `${film.title} · 银幕奖讯`,
      description: film.synopsis,
      url: `https://news.readcine.com/film/${film.id}`,
      type: "article",
    },
  };
}

function initials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const latin = trimmed.match(/[A-Za-z]+/g);
  if (latin && latin.length > 0) {
    return latin
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("");
  }
  return trimmed.slice(0, 2);
}

export default async function FilmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const film = getFilm(id);
  if (!film) notFound();

  const events = getFilmEvents(film.id);
  const colors = film.posterColors || ["#1a1a2e", "#334155"];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: film.title,
    alternateName: film.titleEn,
    dateCreated: String(film.year),
    description: film.synopsis,
    director: film.directors.map((name) => ({ "@type": "Person", name })),
    inLanguage: "zh-CN",
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-xs text-cinema-muted">
        <Link href="/" className="hover:text-cinema-gold">
          ← 时间线
        </Link>
      </p>

      <section className="overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
        <div className="flex flex-col sm:flex-row">
          <div
            className="aspect-[2/3] w-full shrink-0 sm:w-[180px]"
            style={{
              background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
            }}
          >
            {film.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={film.poster}
                alt={film.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center font-display text-3xl text-white/80 sm:min-h-0">
                {initials(film.titleEn || film.title)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 p-5 sm:p-7">
            <p className="text-xs uppercase tracking-[0.18em] text-cinema-gold">
              {film.genres.join(" · ") || "影片"}
            </p>
            <h1 className="mt-2 font-display text-3xl text-cinema-text">
              {film.title}
              <span className="ml-2 font-sans text-base font-normal text-cinema-muted">
                {film.year}
              </span>
            </h1>
            {film.titleEn ? (
              <p className="mt-1 text-sm text-cinema-muted">{film.titleEn}</p>
            ) : null}
            {film.directors.length > 0 ? (
              <p className="mt-3 text-sm text-cinema-muted">
                导演 {film.directors.join("、")}
              </p>
            ) : null}
            {film.cast.length > 0 ? (
              <p className="mt-1 text-sm text-cinema-muted">
                主演 {film.cast.join("、")}
              </p>
            ) : null}
            {film.country && film.country.length > 0 ? (
              <p className="mt-1 text-xs text-cinema-muted/70">
                {film.country.join(" / ")}
              </p>
            ) : null}
            <p className="mt-4 text-sm leading-relaxed text-cinema-muted">
              {film.synopsis}
            </p>
          </div>
        </div>
      </section>

      {film.streaming.length > 0 ? (
        <section>
          <h2 className="font-display text-lg text-cinema-text">流媒体</h2>
          <ul className="mt-3 space-y-2">
            {film.streaming.map((release) => {
              const platform =
                PLATFORM_LABELS[release.platform] || release.platform;
              const status = RELEASE_STATUS_LABELS[release.status];
              const when = release.date ? formatDate(release.date) : "待定";
              return (
                <li
                  key={`${release.platform}-${release.date || "tba"}`}
                  className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 text-sm text-cinema-muted"
                >
                  {platform} · {status} {when}
                  {release.region ? ` · ${release.region}` : ""}
                  {release.note ? `（${release.note}）` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-lg text-cinema-text">相关奖讯</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-cinema-muted">暂无已发生的时间线事件。</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
                  <time dateTime={event.date || undefined}>{event.dateLabel}</time>
                  <TypeBadge type={event.type} label={event.badge} />
                </div>
                <p className="mt-1.5 text-sm text-cinema-text">{event.summary}</p>
                {event.detail ? (
                  <p className="mt-1 text-xs text-cinema-muted/70">{event.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
