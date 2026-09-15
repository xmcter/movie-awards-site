import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TypeBadge } from "@/components/Badge";
import { getFilm, getTimelineEvents, splitFilmCopy } from "@/lib/data";

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
  const event = getTimelineEvents().find((e) => e.id === id);
  if (!event) return { title: "未找到" };
  const film = event.filmId ? getFilm(event.filmId) : undefined;
  const { plot, background } = film ? splitFilmCopy(film) : { plot: "", background: "" };
  const title = event.summary || event.filmTitle;
  const description = event.detail || plot || background || event.summary;
  return {
    title,
    description,
    alternates: { canonical: `/event/${event.id}` },
    openGraph: {
      title: `${title} · 银幕新讯`,
      description,
      url: `https://news.readcine.com/event/${event.id}`,
      type: "article",
      images: event.poster ? [{ url: event.poster, alt: event.filmTitle }] : undefined,
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
  const event = getTimelineEvents().find((e) => e.id === id);
  if (!event) notFound();
  const film = event.filmId ? getFilm(event.filmId) : undefined;
  const { plot, background } = film ? splitFilmCopy(film) : { plot: "", background: "" };
  const directors =
    (film?.directors && film.directors.length > 0 ? film.directors : event.directors) || [];
  const colors = event.posterColors || ["#1a1a2e", "#334155"];
  const badge = event.badge === "新品" ? "新片" : event.badge;

  return (
    <div className="space-y-7">
      <p className="text-xs text-cinema-muted">
        <Link href="/" className="hover:text-cinema-gold">
          ← 时间线
        </Link>
        {event.filmId ? (
          <>
            <span className="mx-2 opacity-40">/</span>
            <Link href={`/film/${event.filmId}`} className="hover:text-cinema-gold">
              影片档
            </Link>
          </>
        ) : null}
      </p>

      <article className="overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
        <div className="flex flex-row items-stretch">
          <div
            className="m-4 mr-0 aspect-[2/3] w-[96px] shrink-0 overflow-hidden rounded-lg sm:m-5 sm:mr-0 sm:w-[120px]"
            style={{ background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})` }}
          >
            {event.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.poster} alt={event.filmTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-xl text-white/80">
                {initials(event.filmTitleEn || event.filmTitle)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 p-4 pl-3 sm:p-5 sm:pl-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
              <time dateTime={event.date || undefined}>{event.dateLabel}</time>
              <TypeBadge type={event.type} label={badge} />
            </div>
            <h1 className="mt-2 font-display text-2xl leading-snug text-cinema-text sm:text-[1.65rem]">
              {event.filmTitle}
              {event.filmYear ? (
                <span className="ml-2 font-sans text-base font-normal text-cinema-muted">
                  {event.filmYear}
                </span>
              ) : null}
            </h1>
            {event.filmTitleEn ? (
              <p className="mt-1 text-sm text-cinema-muted">{event.filmTitleEn}</p>
            ) : null}
          </div>
        </div>
      </article>

      <Section title="导演">
        {directors.length > 0 ? (
          <p className="text-cinema-text">{directors.join("、")}</p>
        ) : (
          <p>尚无导演资料，不编造。</p>
        )}
        {film && film.cast.length > 0 ? (
          <p className="mt-2 text-xs text-cinema-muted/70">主演 {film.cast.join("、")}</p>
        ) : null}
      </Section>

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
        </Section>
      ) : null}

      {background ? (
        <Section title="创作背景">
          <p>{background}</p>
        </Section>
      ) : null}

      {!plot && !background ? (
        <Section title="剧情简介">
          <p>尚无公开剧情与创作资料，不编造。</p>
        </Section>
      ) : null}
    </div>
  );
}
