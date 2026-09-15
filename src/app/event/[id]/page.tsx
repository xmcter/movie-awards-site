import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TypeBadge } from "@/components/Badge";
import { getTimelineEvents } from "@/lib/data";

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
  const title = event.summary || event.filmTitle;
  return {
    title,
    description: event.detail || event.summary,
    alternates: { canonical: `/event/${event.id}` },
    openGraph: {
      title: `${title} · 银幕新讯`,
      description: event.detail || event.summary,
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

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = getTimelineEvents().find((e) => e.id === id);
  if (!event) notFound();
  const colors = event.posterColors || ["#1a1a2e", "#334155"];
  const badge = event.badge === "新品" ? "新片" : event.badge;

  return (
    <div className="space-y-8">
      <p className="text-xs text-cinema-muted">
        <Link href="/" className="hover:text-cinema-gold">
          ← 时间线
        </Link>
        {event.filmId ? (
          <>
            <span className="mx-2 opacity-40">/</span>
            <Link href={`/film/${event.filmId}`} className="hover:text-cinema-gold">
              影片页
            </Link>
          </>
        ) : null}
      </p>

      <article className="overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
        <div className="flex flex-col sm:flex-row">
          <div
            className="aspect-[2/3] w-full shrink-0 sm:w-[180px]"
            style={{ background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})` }}
          >
            {event.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.poster} alt={event.filmTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center font-display text-3xl text-white/80 sm:min-h-0">
                {initials(event.filmTitleEn || event.filmTitle)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
              <time dateTime={event.date || undefined}>{event.dateLabel}</time>
              <TypeBadge type={event.type} label={badge} />
            </div>
            <h1 className="mt-3 font-display text-3xl text-cinema-text">
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
            {event.directors && event.directors.length > 0 ? (
              <p className="mt-3 text-xs text-cinema-muted/70">
                导演 {event.directors.join("、")}
              </p>
            ) : null}
          </div>
        </div>
      </article>

      <section>
        <h2 className="font-display text-lg text-cinema-text">本条消息</h2>
        <p className="mt-3 text-base leading-relaxed text-cinema-text">{event.summary}</p>
        {event.awards && event.awards.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-cinema-muted">
            {event.awards.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {event.detail ? (
          <p className="mt-4 text-sm leading-relaxed text-cinema-muted">{event.detail}</p>
        ) : (
          <p className="mt-4 text-sm text-cinema-muted/70">暂无更多公开细节，不编造。</p>
        )}
      </section>
    </div>
  );
}
