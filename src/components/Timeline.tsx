"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TimelineEvent, TimelineEventType } from "@/types";
import { TypeBadge } from "@/components/Badge";
import { markClicked, readClicked, readLastId, readScroll, saveScroll } from "@/lib/readProgress";
import {
  DISMISS_EVENT_NAME,
  blockEvent,
  clearDismissMarks,
  isBlockedOrSimilar,
  loadDismissMarks,
  unblockEvent,
  type DismissStore,
} from "@/lib/dismiss";

type FilterKey = "all" | TimelineEventType;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "auteur", label: "新片" },
  { key: "win", label: "获奖" },
  { key: "nomination", label: "入围或提名" },
  { key: "streaming", label: "流媒体" },
];

const PIN_NEW = 10;

function initials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const latin = trimmed.match(/[A-Za-z]+/g);
  if (latin && latin.length > 0) {
    return latin.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
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
        aspectRatio: "2 / 3",
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

function displayBadge(label?: string) {
  return label === "新品" ? "新片" : label;
}

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [seen, setSeen] = useState<string[]>([]);
  const [dismissStore, setDismissStore] = useState<DismissStore>({ blocked: {} });
  const [showBlocked, setShowBlocked] = useState(false);
  const [lastUndo, setLastUndo] = useState<{ event: TimelineEvent; message: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSeen(readClicked());
    setDismissStore(loadDismissMarks());
    setReady(true);

    const onDismissUpdate = () => {
      setDismissStore(loadDismissMarks());
    };
    window.addEventListener(DISMISS_EVENT_NAME, onDismissUpdate);
    window.addEventListener("storage", onDismissUpdate);

    const last = readLastId();
    const y = readScroll();
    requestAnimationFrame(() => {
      if (last) {
        const el = document.querySelector(`[data-event-id="${CSS.escape(last)}"]`);
        if (el) {
          el.scrollIntoView({ block: "center" });
          return;
        }
      }
      if (y > 0) window.scrollTo(0, y);
    });

    let tick = 0;
    const onScroll = () => {
      if (tick) return;
      tick = requestAnimationFrame(() => {
        tick = 0;
        saveScroll(window.scrollY || 0);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(DISMISS_EVENT_NAME, onDismissUpdate);
      window.removeEventListener("storage", onDismissUpdate);
    };
  }, []);

  const handleToggleDismiss = (event: TimelineEvent) => {
    const isBlocked = isBlockedOrSimilar(event, dismissStore);
    if (isBlocked) {
      const updated = unblockEvent(event, dismissStore);
      setDismissStore(updated);
      setLastUndo(null);
    } else {
      const updated = blockEvent(event, dismissStore);
      setDismissStore(updated);
      const title = event.headline || event.filmTitle;
      setLastUndo({
        event,
        message: `已屏蔽「${title}」及类似条目`,
      });
    }
  };

  const handleUndo = () => {
    if (!lastUndo) return;
    const updated = unblockEvent(lastUndo.event, dismissStore);
    setDismissStore(updated);
    setLastUndo(null);
  };

  const handleClearAll = () => {
    const updated = clearDismissMarks();
    setDismissStore(updated);
    setShowBlocked(false);
    setLastUndo(null);
  };

  const blockedCount = useMemo(() => {
    return Object.keys(dismissStore.blocked || {}).length;
  }, [dismissStore]);

  // 过滤顺序：现有 type 筛选 / 搜索 → 不再推荐过滤 → 渲染。
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = events.filter((e) => {
      if (filter !== "all" && e.type !== filter) return false;
      if (!q) return true;
      const hay = [
        e.headline,
        e.filmTitle,
        e.filmTitleEn,
        e.summary,
        e.detail,
        e.badge,
        ...(e.directors ?? []),
        ...(e.awards ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    // 不再推荐过滤
    const afterDismiss = showBlocked
      ? matched
      : matched.filter((e) => !isBlockedOrSimilar(e, dismissStore));

    if (filter !== "all" || q) return afterDismiss;

    const pinned = afterDismiss.filter((e) => e.type === "auteur").slice(0, PIN_NEW);
    const ids = new Set(pinned.map((e) => e.id));
    return [...pinned, ...afterDismiss.filter((e) => !ids.has(e.id))];
  }, [events, filter, query, dismissStore, showBlocked]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: 0,
      nomination: 0,
      win: 0,
      streaming: 0,
      auteur: 0,
    };
    for (const e of events) {
      if (!isBlockedOrSimilar(e, dismissStore)) {
        c.all += 1;
        c[e.type] += 1;
      }
    }
    return c;
  }, [events, dismissStore]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
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

          {ready && blockedCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full border border-cinema-border/80 bg-cinema-card px-3 py-1 text-xs text-cinema-muted">
              <span>已屏蔽 {blockedCount} 条</span>
              <button
                type="button"
                onClick={() => setShowBlocked((s) => !s)}
                className="ml-1 text-cinema-muted hover:text-cinema-gold underline underline-offset-2 transition"
              >
                {showBlocked ? "隐藏已屏蔽" : "查看"}
              </button>
              <span className="text-cinema-border">·</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-cinema-gold hover:underline transition"
              >
                清除不再推荐
              </button>
            </div>
          ) : null}
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

      {lastUndo ? (
        <div className="flex items-center justify-between rounded-xl border border-cinema-gold/30 bg-cinema-card px-4 py-2.5 text-xs text-cinema-text">
          <span className="line-clamp-1">{lastUndo.message}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="ml-3 shrink-0 font-medium text-cinema-gold hover:underline"
          >
            ↩ 撤销
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cinema-border px-4 py-10 text-center text-sm text-cinema-muted">
          没有匹配的时间线事件
        </p>
      ) : (
        <ol className="relative space-y-0 border-l border-cinema-border pl-6 sm:pl-8">
          {filtered.map((event) => {
            const read = seen.includes(event.id);
            const isBlocked = isBlockedOrSimilar(event, dismissStore);
            const linkHref = event.filmId
              ? `/film/${encodeURIComponent(event.filmId)}`
              : `/event/${encodeURIComponent(event.id)}`;

            return (
              <li key={event.id} className="relative pb-8 last:pb-0" data-event-id={event.id}>
                <span
                  className="absolute -left-[1.55rem] top-1.5 h-3 w-3 rounded-full border-2 border-cinema-bg sm:-left-[2.05rem]"
                  style={{ backgroundColor: dotColor(event.type) }}
                />
                <article
                  className={`overflow-hidden rounded-xl border bg-cinema-card transition ${
                    isBlocked
                      ? "border-dashed border-cinema-border/70 opacity-60"
                      : read
                        ? "border-cinema-border opacity-60 hover:border-cinema-gold/30"
                        : "border-cinema-border hover:border-cinema-gold/30"
                  }`}
                >
                  <div className="flex flex-row items-start">
                    <Link
                      href={linkHref}
                      prefetch={false}
                      onClick={() => markClicked(event.id)}
                      className="m-3 mr-0 h-[108px] w-[72px] shrink-0 overflow-hidden rounded-md sm:m-4 sm:h-[126px] sm:w-[84px] focus:outline-none"
                    >
                      <EventPoster event={event} className="h-full w-full" />
                    </Link>
                    <div className="min-w-0 flex-1 p-3 pl-3 sm:p-5 sm:pl-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
                        <time dateTime={event.date || undefined}>{event.dateLabel}</time>
                        {event.date ? (
                          <span className="text-[10px] tracking-wide text-cinema-muted/45">
                            消息时间
                          </span>
                        ) : null}
                        <TypeBadge type={event.type} label={displayBadge(event.badge)} />
                        {isBlocked ? (
                          <span className="rounded bg-cinema-elevated px-1.5 py-0.5 text-[10px] text-cinema-gold">
                            已屏蔽
                          </span>
                        ) : null}
                      </div>
                      <Link
                        href={linkHref}
                        prefetch={false}
                        onClick={() => markClicked(event.id)}
                        className="group block focus:outline-none"
                      >
                        <h2 className="mt-2 font-display text-[1.05rem] leading-snug text-cinema-text group-hover:text-cinema-gold-light sm:text-lg">
                          {event.headline || event.summary || event.filmTitle}
                        </h2>
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-cinema-muted">
                          {event.summary}
                        </p>
                      </Link>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cinema-muted/65">
                        <div>
                          {event.filmId ? (
                            <Link
                              href={`/film/${encodeURIComponent(event.filmId)}`}
                              prefetch={false}
                              onClick={() => markClicked(event.id)}
                              className="hover:text-cinema-gold transition"
                            >
                              {event.filmTitle}
                              {event.filmYear ? ` · ${event.filmYear}` : ""}
                              {event.directors && event.directors[0] ? ` · ${event.directors[0]}` : ""}
                              <span className="ml-2 text-cinema-gold/70">影片档 →</span>
                            </Link>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleDismiss(event);
                          }}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition active:scale-95 ${
                            isBlocked
                              ? "border border-cinema-gold/40 bg-cinema-gold/10 text-cinema-gold hover:bg-cinema-gold/20"
                              : "border border-cinema-border/60 text-cinema-muted/70 hover:border-cinema-gold/40 hover:text-cinema-text hover:bg-cinema-elevated"
                          }`}
                          title={isBlocked ? "撤销屏蔽本条及相关条目" : "不再推荐本条及类似内容"}
                        >
                          {isBlocked ? "↩ 撤销屏蔽" : "✕ 不再推荐"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
