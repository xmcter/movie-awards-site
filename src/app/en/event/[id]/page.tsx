import type { Metadata } from "next";
import Link from "next/link";
import { SeenMark } from "@/components/CrossSeen";
import ReleaseLabel from "@/components/ReleaseLabel";
import FilmMeta from "@/components/FilmMeta";
import WeiboLink from "@/components/WeiboLink";
import { notFound } from "next/navigation";
import { TypeBadge } from "@/components/Badge";
import EventDismissButton from "@/components/EventDismissButton";
import EventPager from "@/components/EventPager";
import ShowSources from "@/components/ShowSources";
import {
  getFilm,
  getTimelineEvents,
  splitFilmCopy,
  truncateDescription,
  doubanIdOf,
} from "@/lib/data";
import { dedupeSubtitleAgainstTitleEn } from "@/lib/headlines-en";
import LazyPoster from "@/components/LazyPoster";
import { bilingualAlternatesEn, cleanGuideDirector, directorNamesEn, filmTitleEn, UI_EN } from "@/lib/i18n";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getTimelineEvents("en").map((event) => ({ id: event.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    decoded = id;
  }
  const event = getTimelineEvents("en").find((e) => e.id === id || e.id === decoded);
  if (!event) return { title: "Not found" };
  const film = event.filmId ? getFilm(event.filmId) : undefined;
  const { plot, background } = film ? splitFilmCopy(film, "en") : { plot: "", background: "" };
  const title = event.headline || event.summary || event.filmTitle;
  const extra = [event.detail, plot, background].find((s) => s && s !== event.summary) || "";
  const rawDescription =
    [event.summary, extra].filter(Boolean).join(". ") ||
    `${event.filmTitle}${event.filmYear ? ` (${event.filmYear})` : ""} — streaming dates and film page.`;
  const description = truncateDescription(rawDescription, 150);
  return {
    title,
    description,
    twitter: { card: "summary_large_image", title, description },
    alternates: bilingualAlternatesEn(`/en/event/${event.id}`),
    openGraph: {
      title,
      description,
      url: `https://news.readcine.com/en/event/${event.id}`,
      type: "article",
      locale: "en_US",
      images: event.poster ? [{ url: event.poster, alt: event.filmTitle }] : [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
    },
  };
}

function initials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const latin = trimmed.match(/[A-Za-z]+/g);
  if (latin && latin.length > 0) {
    return latin.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  }
  return trimmed.slice(0, 2);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg text-cinema-text">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-cinema-muted">{children}</div>
    </section>
  );
}

export default async function EventPageEn({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    decoded = id;
  }
  const timeline = getTimelineEvents("en");
  const event = timeline.find((e) => e.id === id || e.id === decoded);
  if (!event) notFound();
  const film = event.filmId ? getFilm(event.filmId) : undefined;
  const { plot, background } = film ? splitFilmCopy(film, "en") : { plot: "", background: "" };
  const directors =
    (film?.directors && film.directors.length > 0 ? directorNamesEn(film.directors) : directorNamesEn(event.directors)) || [];
  const castEn = directorNamesEn(film?.cast);
  const colors = event.posterColors || ["#1a1a2e", "#334155"];
  const badge = event.badge;
  const pagerItems = timeline.map((e) => ({
    id: e.id,
    title: e.headline || e.filmTitle,
    filmId: e.filmId,
    type: e.type,
    headline: e.headline,
    summary: e.summary,
  }));

  const guideQuery = [
    film ? filmTitleEn(film) : event.filmTitle,
    film?.year || event.filmYear,
    cleanGuideDirector(directors[0]),
  ]
    .filter(Boolean)
    .join(" ");
  const guideUrl = `https://guide.readcine.com/?q=${encodeURIComponent(guideQuery)}&pick=1`;

  return (
    <div className="space-y-6">
      <SeenMark film={{ id: film?.id || event.filmId || `event-${event.id}`, title: film?.title || event.filmTitleZh || event.filmTitle, titleEn: film?.titleEn || event.filmTitleEn, year: film?.year || event.filmYear, doubanId: film ? doubanIdOf(film) : event.filmDoubanId }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@graph": [
          { "@type": "Article", headline: event.headline || event.filmTitle,
            description: truncateDescription(event.plot || event.summary || event.headline || event.filmTitle, 150),
            mainEntityOfPage: `https://news.readcine.com/en/event/${event.id}`,
            ...(event.sourcePublishedAt || event.publishedAt ? { datePublished: event.sourcePublishedAt || event.publishedAt } : {}),
            ...(event.poster ? { image: new URL(event.poster, "https://news.readcine.com").href } : {}),
            inLanguage: "en", about: { "@type": "Movie", name: event.filmTitle },
            ...(event.sourceUrl ? { isBasedOn: event.sourceUrl } : {}) },
          { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Screen News", item: "https://news.readcine.com/en/" },
            { "@type": "ListItem", position: 2, name: event.filmTitle, item: `https://news.readcine.com/en/event/${event.id}` }
          ] }
        ]
      }).replace(/</g, "\\u003c") }} />
      <div className="flex items-center justify-between gap-4 text-xs text-cinema-muted">
        <p>
          <Link href="/en" className="hover:text-cinema-gold">
            ← Timeline
          </Link>
          {event.filmId ? (
            <>
              <span className="mx-2 opacity-40">/</span>
              <Link href={`/en/film/${event.filmId}`} className="hover:text-cinema-gold">
                {event.filmKind === "jury" || event.filmKind === "honor"
                  ? "Profile"
                  : "Film page"}
              </Link>
            </>
          ) : null}
        </p>
        <EventDismissButton event={event} locale="en" />
      </div>

      <article className="overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
        <div className="flex flex-row items-start">
          <div
            className="m-3 mr-0 h-[120px] w-[80px] shrink-0 overflow-hidden rounded-md sm:m-4 sm:h-[144px] sm:w-[96px]"
            style={{
              background: colors[0],
              aspectRatio: "2 / 3",
            }}
          >
            {event.poster ? (
              <LazyPoster
                src={event.poster}
                alt={event.filmTitle}
                fallback={initials(event.filmTitleEn || event.filmTitle)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-sm text-white/80">
                {initials(event.filmTitleEn || event.filmTitle)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 p-3 pl-3 sm:p-4 sm:pl-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
              <TypeBadge type={event.type} label={badge} headline={event.headline} locale="en" />
              <ShowSources>
              {event.sourceLabel || event.sourcePublishedLabel ? (
                event.sourceUrl && event.sourceLabel ? (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-cinema-border/60 bg-cinema-elevated/50 px-1.5 py-px text-[10px] tracking-wide text-cinema-muted hover:border-cinema-gold/30 transition"
                  >
                    {[event.sourceLabel ? `Source · ${event.sourceLabel}` : null, event.sourcePublishedLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </a>
                ) : (
                  <span className="rounded-full border border-cinema-border/60 bg-cinema-elevated/50 px-1.5 py-px text-[10px] tracking-wide text-cinema-muted">
                    {[event.sourceLabel ? `Source · ${event.sourceLabel}` : null, event.sourcePublishedLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )
              ) : null}
              </ShowSources>
            </div>
            <h1 className="mt-1.5 font-display text-xl leading-snug text-cinema-text sm:text-2xl">
              {event.type === "streaming" && event.date ? <ReleaseLabel date={event.date} title={event.filmTitle} fallback={event.headline || event.filmTitle} locale="en" /> : (event.headline || event.summary || event.filmTitle)}
            </h1>
            {(() => {
              const hl = (event.headline || event.summary || "").toLowerCase();
              const titleInHl =
                Boolean(event.filmTitle) &&
                hl.includes(event.filmTitle.toLowerCase());
              const bits: string[] = [];
              if (!titleInHl && event.filmTitle) bits.push(event.filmTitle);
              if (!bits.length && !event.filmYear) return null;
              return (
                <p className="mt-1 text-xs text-cinema-muted"><FilmMeta year={!hl.includes(String(event.filmYear)) ? event.filmYear : undefined} parts={bits} /></p>
              );
            })()}
            {directors.length > 0 ? (
              <p className="mt-2 text-sm text-cinema-text">Director {directors.join(", ")}</p>
            ) : null}
          </div>
        </div>
      </article>

      {castEn.length > 0 ? (
        <Section title="Cast">
          <p>{castEn.join(", ")}</p>
        </Section>
      ) : null}

      {(() => {
        const title = (event.headline || event.filmTitle || "").trim();
        const summary = dedupeSubtitleAgainstTitleEn(title, event.summary || "");
        const detail = dedupeSubtitleAgainstTitleEn(
          summary || title,
          dedupeSubtitleAgainstTitleEn(title, event.detail || ""),
        );
        const hasAwards = Boolean(event.awards && event.awards.length > 0);
        if (!summary && !detail && !hasAwards) return null;
        return (
          <Section title="This update">
            {summary ? <p className="text-cinema-text">{summary}</p> : null}
            {hasAwards ? (
              <ul className="mt-2 space-y-1">
                {event.awards!.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {detail ? <p className={summary ? "mt-2" : ""}>{detail}</p> : null}
          </Section>
        );
      })()}

      {plot ? (
        <Section title="Plot summary">
          <p>{plot}</p>
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
            <WeiboLink href={event.weiboUrl} label={event.weiboLabel} locale="en" />
          </div>
        </Section>
      ) : guideQuery ? (
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
            <WeiboLink href={event.weiboUrl} label={event.weiboLabel} locale="en" />
          </div>
        </Section>
      ) : null}

      {background ? (
        <Section title="Background">
          <p>{background}</p>
        </Section>
      ) : null}

      <EventPager currentId={event.id} items={pagerItems} locale="en" />
    </div>
  );
}
