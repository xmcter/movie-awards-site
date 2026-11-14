import type { Metadata } from "next";
import type { ReactNode } from "react";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { SeenMark } from "@/components/CrossSeen";
import ReleaseLabel from "@/components/ReleaseLabel";
import FilmMeta from "@/components/FilmMeta";
import WeiboLink from "@/components/WeiboLink";
import { notFound } from "next/navigation";
import { TypeBadge } from "@/components/Badge";
import FilmPoster from "@/app/film/[id]/FilmPoster";
import {
  FILM_ALIASES,
  doubanRatingOf,
  films,
  getFilm,
  getFilmEvents,
  getVerifiedFilmAwards,
  isIndexableFilm,
  splitFilmCopy,
  truncateDescription,
  doubanIdOf,
} from "@/lib/data";
import { dedupeSubtitleAgainstTitleEn, streamingWhenWhereEn } from "@/lib/headlines-en";
import {
  genreLabelsEn,
  filmTitleEn,
  directorNamesEn,
  cleanGuideDirector,
  bilingualAlternatesEn,
  UI_EN,
} from "@/lib/i18n";

export const dynamic = "force-static";

export function generateStaticParams() {
  const uniqueIds = [
    ...new Set([
      ...films.map((film) => film.id),
      ...Object.keys(FILM_ALIASES),
    ]),
  ];
  return uniqueIds.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonicalId = FILM_ALIASES[id];
  if (canonicalId) {
    const targetFilm = getFilm(canonicalId);
    const title = targetFilm ? filmTitleEn(targetFilm) : "Page moved";
    const description = targetFilm
      ? truncateDescription(
          splitFilmCopy(targetFilm, "en").plot ||
            splitFilmCopy(targetFilm, "en").background ||
            `${filmTitleEn(targetFilm)} (${targetFilm.year}) — streaming dates and film page.`,
          150,
        )
      : "This film entry has been merged into the main page.";
    return {
      title,
      description,
      robots: {
        index: false,
        follow: true,
      },
      alternates: bilingualAlternatesEn(`/en/film/${canonicalId}`),
    };
  }

  const film = getFilm(id);
  if (!film) return { title: "Not found" };
  const title = filmTitleEn(film);
  const { plot, background } = splitFilmCopy(film, "en");
  const rawDescription =
    [plot, background].filter(Boolean).join(" ") ||
    `${title} (${film.year}) — streaming dates and film page.`;
  const description = truncateDescription(rawDescription, 150);
  return {
    title,
    description,
    robots: { index: isIndexableFilm(film, "en"), follow: true },
    twitter: { card: "summary_large_image", title, description },
    alternates: bilingualAlternatesEn(`/en/film/${film.id}`),
    openGraph: {
      title,
      description,
      url: `https://news.readcine.com/en/film/${film.id}`,
      type: "article",
      locale: "en_US",
      images: film.poster ? [{ url: film.poster, alt: title }] : [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
    },
  };
}

/** /posters/x.ext → /thumbs/x.webp；与中文影片页同一规则，缺缩略图时回退原图。 */
function thumbForPoster(poster: string): string | undefined {
  if (/^https?:\/\//i.test(poster)) return undefined;
  const marker = "/posters/";
  const at = poster.indexOf(marker);
  if (at < 0) return undefined;
  const file = poster.slice(at + marker.length).split(/[?#]/)[0] ?? "";
  if (!file || file.includes("/")) return undefined;
  const stem = file.replace(/\.[^.]+$/, "");
  if (!stem) return undefined;
  const thumbName = `${stem}.webp`;
  const thumbFile = path.join(process.cwd(), "public", "thumbs", thumbName);
  if (!fs.existsSync(thumbFile)) return undefined;
  return `${poster.slice(0, at)}/thumbs/${thumbName}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg text-cinema-text">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-cinema-muted">{children}</div>
    </section>
  );
}

export default async function FilmPageEn({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const canonicalId = FILM_ALIASES[id];
  if (canonicalId) {
    const targetFilm = getFilm(canonicalId);
    const targetUrl = `/en/film/${canonicalId}`;
    return (
      <div className="space-y-6">
        {/* 与中文别名页同为 0 秒。HTTP 301 见 deploy/nginx.conf.example，目标为 https。 */}
        <meta httpEquiv="refresh" content={`0;url=${targetUrl}`} />
        <p className="text-xs text-cinema-muted">
          <Link href="/en" className="hover:text-cinema-gold">
            ← Timeline
          </Link>
        </p>
        <section className="rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
          <h1 className="font-display text-xl text-cinema-text sm:text-2xl">
            {targetFilm ? `${filmTitleEn(targetFilm)} (merged)` : "Film entry merged"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-cinema-muted">
            This page has been merged into the main film page and is redirecting automatically. If your browser doesn&apos;t redirect, use the link below:
          </p>
          <p className="mt-4">
            <Link
              href={targetUrl}
              className="text-sm font-medium text-cinema-gold underline decoration-cinema-border underline-offset-4 hover:text-cinema-gold-light"
            >
              Go to the {targetFilm ? `${filmTitleEn(targetFilm)} film page` : targetUrl} ({targetUrl}) →
            </Link>
          </p>
        </section>
      </div>
    );
  }

  const film = getFilm(id);
  if (!film) notFound();

  const events = getFilmEvents(film.id, "en");
  const weiboEvent = events.find((event) => event.weiboUrl);
  const colors = film.posterColors || ["#1a1a2e", "#334155"];
  const { plot, background } = splitFilmCopy(film, "en");
  const verifiedAwards = getVerifiedFilmAwards(film.id);
  const douban = doubanRatingOf(film);
  const directorsEn = directorNamesEn(film.directors);
  const castEn = directorNamesEn(film.cast);
  const peopleLabel =
    film.directors.length > 0
      ? "Director"
      : film.genres.includes("评审")
        ? "Jury"
        : film.genres.includes("荣誉")
          ? "Honor"
          : "Director";

  const guideQuery = [
    filmTitleEn(film),
    film.year,
    directorsEn.length > 0 ? cleanGuideDirector(directorsEn[0]) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const guideUrl = `https://guide.readcine.com/?q=${encodeURIComponent(guideQuery)}&pick=1`;

  const alternateName =
    film.title && film.title !== filmTitleEn(film) && !/[\u4e00-\u9fff]/.test(film.title)
      ? film.title
      : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: filmTitleEn(film),
    ...(alternateName ? { alternateName } : {}),
    dateCreated: String(film.year),
    description: plot || background || `${filmTitleEn(film)} (${film.year})`,
    director: directorsEn.map((name) => ({ "@type": "Person", name })),
    inLanguage: "en",
  };

  return (
    <div className="space-y-8">
      <SeenMark film={{ id: film.id, title: film.title, titleEn: film.titleEn, year: film.year, doubanId: doubanIdOf(film) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": [jsonLd, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Screen News", item: "https://news.readcine.com/en/" }, { "@type": "ListItem", position: 2, name: filmTitleEn(film), item: `https://news.readcine.com/en/film/${film.id}` }] }] }).replace(/</g, "\\u003c") }}
      />
      <p className="text-xs text-cinema-muted">
        <Link href="/en" className="hover:text-cinema-gold">
          ← Timeline
        </Link>
      </p>

      <section className="overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
        <div className="flex flex-row items-start">
          <FilmPoster
            src={thumbForPoster(film.poster || "") || film.poster}
            fallbackSrc={film.poster && thumbForPoster(film.poster) ? film.poster : undefined}
            title={filmTitleEn(film)}
            titleEn={film.titleEn || film.title}
            colors={colors}
          />
          <div className="min-w-0 flex-1 p-4 pl-3 sm:p-6 sm:pl-5">
            <p className="text-xs uppercase tracking-[0.18em] text-cinema-gold">
              {genreLabelsEn(film.genres).join(" · ") || "Film"}
            </p>
            <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
              {filmTitleEn(film)}
              <span className="ml-2 font-sans text-base font-normal text-cinema-muted">
                <FilmMeta year={film.year} />
              </span>
            </h1>
            {douban ? (
              <p className="mt-2 text-sm text-cinema-muted" data-douban-rating={douban.score.toFixed(1)}>
                ⭐ Douban <span className="font-medium tabular-nums text-cinema-text">{douban.score.toFixed(1)}</span>
              </p>
            ) : null}
            {film.runtime ? (
              <p className="mt-3 text-xs text-cinema-muted/70">
                {film.runtime} min
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {castEn.length > 0 || (directorsEn.length > 0 && !plot) ? (
        <Section title={directorsEn.length > 0 && !plot && castEn.length > 0 ? "Director & cast" : directorsEn.length > 0 && !plot ? "Director" : peopleLabel !== "Director" ? peopleLabel : "Cast"}>
          {!plot && directorsEn.length > 0 ? (
            <p className="text-cinema-text">
              <span className="text-cinema-muted">Director </span>
              {directorsEn.join(", ")}
            </p>
          ) : null}
          {castEn.length > 0 ? (
            <p className={`${!plot && directorsEn.length > 0 ? "mt-2 " : ""}text-sm text-cinema-text`}>
              <span className="text-cinema-muted">{film.directors.length === 0 && (film.genres.includes("荣誉") || film.genres.includes("评审")) ? peopleLabel : "Cast"} </span>
              {castEn.join(", ")}
            </p>
          ) : null}
        </Section>
      ) : null}

      {plot ? (
        <Section title="Plot">
          {directorsEn.length > 0 ? (
            <p className="mb-3 text-cinema-text">
              <span className="text-cinema-muted">Director </span>
              {directorsEn.join(", ")}
            </p>
          ) : null}
          <p data-film-plot>{plot}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5 pt-1">
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-cinema-border bg-cinema-card px-3 py-1.5 text-xs text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
            >
              <span>{UI_EN.guideInGuide}</span>
              <span className="text-[10px] opacity-70">↗</span>
            </a>
            <WeiboLink href={weiboEvent?.weiboUrl} label={weiboEvent?.weiboLabel} locale="en" />
          </div>
        </Section>
      ) : null}

      {verifiedAwards.length > 0 ? (
        <Section title="Verified awards & nominations">
          <ul data-film-awards className="space-y-1 break-words text-xs leading-relaxed text-cinema-gold/90">
            {verifiedAwards.map((award) => (
              <li key={`${award.year}-${award.festival}-${award.category}-${award.result}`}>
                <a href={award.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {award.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={award.icon} alt={`${award.festivalEn || award.festival} logo`} width={16} height={16} className="mr-1.5 inline-block h-4 w-4 shrink-0 rounded-sm bg-white p-px align-text-bottom object-contain" />
                  ) : null}
                  {award.year} {award.festivalEn || award.festival} · {award.categoryEn || award.category} · {award.result === "won" ? "Won" : "Nominated"}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {background ? (
        <Section title="Background">
          <p>{background}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5 pt-1">
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-cinema-border bg-cinema-card px-3 py-1.5 text-xs text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
            >
              <span>{UI_EN.guideInGuide}</span>
              <span className="text-[10px] opacity-70">↗</span>
            </a>
            <WeiboLink href={weiboEvent?.weiboUrl} label={weiboEvent?.weiboLabel} locale="en" />
          </div>
        </Section>
      ) : null}

      {!plot && !background ? (
        <Section title="Further reading">
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-cinema-border bg-cinema-card px-3 py-1.5 text-xs text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
            >
              <span>{UI_EN.guideInGuide}</span>
              <span className="text-[10px] opacity-70">↗</span>
            </a>
            <WeiboLink href={weiboEvent?.weiboUrl} label={weiboEvent?.weiboLabel} locale="en" />
          </div>
        </Section>
      ) : null}

      {(() => {
        const streaming = [
          ...film.streaming,
          ...films.filter((item) => FILM_ALIASES[item.id] === film.id).flatMap((item) => item.streaming),
        ];
        if (streaming.length === 0) return null;
        return (
        <section>
          <h2 className="font-display text-lg text-cinema-text">Streaming</h2>
          <ul className="mt-3 space-y-2">
            {[...streaming]
              .sort((a, b) => {
                if (a.date && b.date) return a.date.localeCompare(b.date);
                if (a.date) return -1;
                if (b.date) return 1;
                return 0;
              })
              .map((release) => {
              const line = streamingWhenWhereEn({
                date: release.date,
                status: release.status,
                platform: release.platform,
                note: release.note,
              });
              return (
                <li
                  key={`${release.platform}-${release.date || "tba"}`}
                  className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 text-sm text-cinema-muted"
                >
                  {line}
                </li>
              );
            })}
          </ul>
        </section>
        );
      })()}

      <section>
        <h2 className="font-display text-lg text-cinema-text">Related on this site</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-cinema-muted">No timeline events yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
                  {event.type !== "streaming" ? <time dateTime={event.date || undefined}>{event.dateLabel}</time> : null}
                  <TypeBadge type={event.type} label={event.badge} headline={event.headline} locale="en" />
                </div>
                <Link
                  href={`/en/event/${encodeURIComponent(event.id)}`}
                  className="mt-1.5 block text-sm text-cinema-text hover:text-cinema-gold"
                >
                  {event.type === "streaming" && event.date ? <ReleaseLabel date={event.date} title={event.filmTitle} fallback={event.headline || event.filmTitle} locale="en" /> : (event.headline || event.summary)}
                </Link>
                {(() => {
                  const title = (event.headline || "").trim();
                  const summary = dedupeSubtitleAgainstTitleEn(title, event.summary || "");
                  const detail = dedupeSubtitleAgainstTitleEn(
                    summary || title,
                    dedupeSubtitleAgainstTitleEn(title, event.detail || ""),
                  );
                  return (
                    <>
                      {summary ? (
                        <p className="mt-1 text-xs text-cinema-muted">{summary}</p>
                      ) : null}
                      {detail ? (
                        <p className="mt-1 text-xs text-cinema-muted/70">{detail}</p>
                      ) : null}
                    </>
                  );
                })()}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
