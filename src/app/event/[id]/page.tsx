import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TypeBadge } from "@/components/Badge";
import EventDismissButton from "@/components/EventDismissButton";
import EventPager from "@/components/EventPager";
import {
  getFilm,
  getTimelineEvents,
  splitFilmCopy,
  truncateDescription,
} from "@/lib/data";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getTimelineEvents().map((event) => ({ id: event.id }));
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
  const event = getTimelineEvents().find((e) => e.id === id || e.id === decoded);
  if (!event) return { title: "未找到" };
  const film = event.filmId ? getFilm(event.filmId) : undefined;
  const { plot, background } = film ? splitFilmCopy(film) : { plot: "", background: "" };
  const title = event.headline || event.summary || event.filmTitle;
  const extra = [event.detail, plot, background].find((s) => s && s !== event.summary) || "";
  const rawDescription = extra ? `${event.summary}：${extra}` : event.summary;
  const description = truncateDescription(rawDescription, 150);
  return {
    title,
    description,
    alternates: { canonical: `/event/${event.id}` },
    openGraph: {
      title: `${title} · 银幕新讯`,
      description,
      url: `https://news.readcine.com/event/${event.id}`,
      type: "article",
      images: event.poster ? [{ url: event.poster, alt: event.filmTitle }] : [{ url: "/og.png", width: 1200, height: 630, alt: "银幕新讯" }],
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

export default async function EventPage({
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
  const timeline = getTimelineEvents();
  const event = timeline.find((e) => e.id === id || e.id === decoded);
  if (!event) notFound();
  const film = event.filmId ? getFilm(event.filmId) : undefined;
  const { plot, background } = film ? splitFilmCopy(film) : { plot: "", background: "" };
  const directors =
    (film?.directors && film.directors.length > 0 ? film.directors : event.directors) || [];
  const colors = event.posterColors || ["#1a1a2e", "#334155"];
  const badge = event.badge === "新品" ? "新片" : event.badge;
  const pagerItems = timeline.map((e) => ({ id: e.id, title: e.headline || e.filmTitle }));

  const guideQuery = [
    film?.title || event.filmTitle,
    film?.year || event.filmYear,
    film?.titleEn || event.filmTitleEn,
    directors[0],
  ]
    .filter(Boolean)
    .join(" ");
  const guideUrl = `https://guide.readcine.com/?q=${encodeURIComponent(guideQuery)}&pick=1`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 text-xs text-cinema-muted">
        <p>
          <Link href="/" className="hover:text-cinema-gold">
            ← 时间线
          </Link>
          {event.filmId ? (
            <>
              <span className="mx-2 opacity-40">/</span>
              <Link href={`/film/${event.filmId}`} className="hover:text-cinema-gold">
                {event.filmKind === "jury" || event.filmKind === "honor"
                  ? "人物档"
                  : "影片档"}
              </Link>
            </>
          ) : null}
        </p>
        <EventDismissButton event={event} />
      </div>

      <article className="overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
        <div className="flex flex-row items-start">
          <div
            className="m-3 mr-0 h-[120px] w-[80px] shrink-0 overflow-hidden rounded-md sm:m-4 sm:h-[144px] sm:w-[96px]"
            style={{
              background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
              aspectRatio: "2 / 3",
            }}
          >
            {event.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.poster} alt={event.filmTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-sm text-white/80">
                {initials(event.filmTitleEn || event.filmTitle)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 p-3 pl-3 sm:p-4 sm:pl-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
              <time dateTime={event.date || undefined}>{event.dateLabel}</time>
              <TypeBadge type={event.type} label={badge} />
            </div>
            <h1 className="mt-1.5 font-display text-xl leading-snug text-cinema-text sm:text-2xl">
              {event.headline || event.summary || event.filmTitle}
            </h1>
            <p className="mt-1 text-xs text-cinema-muted">
              {event.filmTitle}
              {event.filmYear ? ` · ${event.filmYear}` : ""}
              {event.filmTitleEn ? ` / ${event.filmTitleEn}` : ""}
            </p>
            {directors.length > 0 ? (
              <p className="mt-2 text-sm text-cinema-text">导演 {directors.join("、")}</p>
            ) : null}
          </div>
        </div>
      </article>

      {film && film.cast.length > 0 ? (
        <Section title="主演">
          <p>{film.cast.join("、")}</p>
        </Section>
      ) : null}

      <Section title="本条消息">
        <p className="text-cinema-text">{event.summary}</p>
        {event.awards && event.awards.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {event.awards.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {event.detail ? <p className="mt-2">{event.detail}</p> : null}
      </Section>

      {plot ? (
        <Section title="剧情简介">
          <p>{plot}</p>
          <div className="mt-4 pt-1">
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-cinema-border bg-cinema-card px-3 py-1.5 text-xs text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
            >
              <span>🎞️ 在「观影导赏」查看导赏</span>
              <span className="text-[10px] opacity-70">↗</span>
            </a>
          </div>
        </Section>
      ) : (
        <Section title="剧情简介">
          <p>尚无公开剧情资料，不编造。</p>
          {guideQuery ? (
            <div className="mt-4 pt-1">
              <a
                href={guideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-cinema-border bg-cinema-card px-3 py-1.5 text-xs text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
              >
                <span>🎞️ 在「观影导赏」查看导赏</span>
                <span className="text-[10px] opacity-70">↗</span>
              </a>
            </div>
          ) : null}
        </Section>
      )}

      {background ? (
        <Section title="创作背景">
          <p>{background}</p>
        </Section>
      ) : null}

      <EventPager currentId={event.id} items={pagerItems} />
    </div>
  );
}
