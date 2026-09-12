"use client";

import { useMemo, useState } from "react";
import type { TimelineEvent, TimelineEventType } from "@/types";
import { TypeBadge } from "@/components/Badge";

type FilterKey = "all" | TimelineEventType;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "win", label: "获奖" },
  { key: "nomination", label: "入围" },
  { key: "auteur", label: "作者" },
  { key: "streaming", label: "流媒体" },
];

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

function EventPoster({
  event,
  className,
}: {
  event: TimelineEvent;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const colors = event.posterColors || ["#1a1a2e", "#334155"];
  const showImg = Boolean(event.poster) && !failed;

  return (
    <div
      className={className}
      style={{
        background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.poster}
          alt={event.filmTitle}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-1 text-center font-display text-xl tracking-wide text-white/80">
          {initials(event.filmTitleEn || event.filmTitle)}
        </div>
      )}
    </div>
  );
}

function dotColor(type: TimelineEventType): string {
  if (type === "win") return "#c9a227";
  if (type === "nomination") return "#38bdf8";
  if (type === "auteur") return "#a78bfa";
  return "#34d399";
}

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "all" && e.type !== filter) return false;
      if (!q) return true;
      const hay = [e.filmTitle, e.filmTitleEn, e.summary, e.detail, e.badge]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, filter, query]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: events.length,
      nomination: 0,
      win: 0,
      streaming: 0,
      auteur: 0,
    };
    for (const e of events) c[e.type] += 1;
    return c;
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                  active
                    ? "bg-cinema-gold text-cinema-bg"
                    : "border border-cinema-border text-cinema-muted hover:border-cinema-gold/40 hover:text-cinema-text"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${active ? "opacity-70" : "opacity-50"}`}>
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative block w-full sm:max-w-[220px]">
          <span className="sr-only">搜索</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索影片 / 导演 / 电影节…"
            className="w-full rounded-full border border-cinema-border bg-cinema-card px-4 py-1.5 text-sm text-cinema-text placeholder:text-cinema-muted/60 focus:border-cinema-gold/50 focus:outline-none"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cinema-border px-4 py-10 text-center text-sm text-cinema-muted">
          没有匹配的时间线事件
        </p>
      ) : (
        <ol className="relative space-y-0 border-l border-cinema-border pl-6 sm:pl-8">
          {filtered.map((event) => (
            <li key={event.id} className="relative pb-8 last:pb-0">
              <span
                className="absolute -left-[1.55rem] top-1.5 h-3 w-3 rounded-full border-2 border-cinema-bg sm:-left-[2.05rem]"
                style={{ backgroundColor: dotColor(event.type) }}
              />
              <article className="overflow-hidden rounded-xl border border-cinema-border bg-cinema-card transition hover:border-cinema-gold/30">
                <div className="flex flex-row items-stretch">
                  <EventPoster
                    event={event}
                    className="m-3 mr-0 aspect-[2/3] w-[100px] shrink-0 overflow-hidden rounded-lg sm:m-4 sm:mr-0 sm:w-[112px]"
                  />
                  <div className="min-w-0 flex-1 p-3 pl-3 sm:p-5 sm:pl-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
                      <time dateTime={event.date || undefined}>{event.dateLabel}</time>
                      {event.date ? (
                        <span className="text-[10px] tracking-wide text-cinema-muted/45">
                          消息时间
                        </span>
                      ) : null}
                      <TypeBadge type={event.type} />
                    </div>
                    <h2 className="mt-2 font-display text-lg text-cinema-text">
                      {event.filmTitle}
                      {event.filmYear ? (
                        <span className="ml-2 text-sm font-sans font-normal text-cinema-muted">
                          {event.filmYear}
                        </span>
                      ) : null}
                    </h2>
                    {event.filmTitleEn ? (
                      <p className="text-xs text-cinema-muted/80">{event.filmTitleEn}</p>
                    ) : null}
                    <p className="mt-2 text-sm leading-relaxed text-cinema-muted">
                      {event.summary}
                    </p>
                    {event.detail ? (
                      <p className="mt-1 text-xs text-cinema-muted/70">{event.detail}</p>
                    ) : null}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
