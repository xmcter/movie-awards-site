"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { TimelineEvent, TimelineEventType } from "@/types";
import { TypeBadge } from "@/components/Badge";
import ResumeBar from "@/components/ResumeBar";
import {
  getVisitBaseline,
  isNewSince,
  writeLastSeen,
  type LastSeenMarker,
} from "@/lib/lastSeen";
import {
  absoluteDayLabel,
  groupByDay,
  relativeDayPrefix,
  shanghaiToday,
} from "@/lib/dayGroups";
import { markClicked, readClicked } from "@/lib/readProgress";
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
  { key: "all", label: "全部雷达" },
  { key: "streaming", label: "流媒体与熟肉" },
  { key: "auteur", label: "高分与新片" },
  { key: "win", label: "影展大奖" },
  { key: "nomination", label: "入围提名" },
];

const PIN_NEW = 10;
const DEDUP_STORAGE_KEY = "news_dedup_by_film_v1";

interface GroupedTimelineItem {
  event: TimelineEvent;
  priorEvents: TimelineEvent[];
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

/** Viewed = page visible for this long after load; only then may the marker advance. */
const VIEW_DWELL_MS = 2500;

function LastSeenDivider() {
  return (
    <div
      data-last-seen-divider
      role="separator"
      aria-label="上次看到这里"
      className="flex items-center gap-3 text-xs font-medium tracking-wide text-cinema-gold"
    >
      <span className="h-px flex-1 bg-cinema-gold/45" />
      <span>— 上次看到这里 —</span>
      <span className="h-px flex-1 bg-cinema-gold/45" />
    </div>
  );
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
  const [dedupByFilm, setDedupByFilm] = useState(true);
  const [expandedFilms, setExpandedFilms] = useState<Record<string, boolean>>({});
  const [baseline, setBaseline] = useState<LastSeenMarker | null>(null);
  const [today, setToday] = useState("");
  const viewedRef = useRef(false);

  // Cards that are actually visible to the user (dismissed excluded, filters ignored).
  const visibleAll = useMemo(
    () => events.filter((e) => !isBlockedOrSimilar(e, dismissStore)),
    [events, dismissStore],
  );
  const visibleAllRef = useRef(visibleAll);
  visibleAllRef.current = visibleAll;

  const isCardNew = useCallback(
    (e: TimelineEvent) => isNewSince(e, baseline) && !isBlockedOrSimilar(e, dismissStore),
    [baseline, dismissStore],
  );

  const newSinceCount = useMemo(
    () => {
      if (!baseline) return 0;
      const fresh = visibleAll.filter((e) => isNewSince(e, baseline));
      // match what the list shows: with 「每片仅最新」 one card per film
      return dedupByFilm ? new Set(fresh.map((e) => e.filmId || e.id)).size : fresh.length;
    },
    [visibleAll, baseline, dedupByFilm],
  );

  // Advance the 「上次看到这里」 marker only after the page has been visible for a
  // moment, and only when the user leaves (tab hidden / pagehide / navigates away).
  useEffect(() => {
    let visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
    let dwell = 0;
    const timer = window.setInterval(() => {
      if (viewedRef.current) return;
      if (document.visibilityState === "visible" && visibleSince) {
        if (dwell + (Date.now() - visibleSince) >= VIEW_DWELL_MS) viewedRef.current = true;
      }
    }, 500);
    const commit = () => {
      if (viewedRef.current) writeLastSeen(visibleAllRef.current);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (visibleSince) dwell += Date.now() - visibleSince;
        visibleSince = 0;
        if (dwell >= VIEW_DWELL_MS) viewedRef.current = true;
        commit();
      } else {
        visibleSince = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", commit);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", commit);
      commit(); // client-side navigation to a film / event page
    };
  }, []);

  useEffect(() => {
    setSeen(readClicked());
    const initialDismiss = loadDismissMarks();
    setDismissStore(initialDismiss);
    const visitBaseline = getVisitBaseline();
    setBaseline(visitBaseline);
    setToday(shanghaiToday());
    try {
      const savedDedup = localStorage.getItem(DEDUP_STORAGE_KEY);
      if (savedDedup !== null) {
        setDedupByFilm(savedDedup === "true");
      }
    } catch {}
    setReady(true);

    const onDismissUpdate = () => {
      setDismissStore(loadDismissMarks());
    };
    window.addEventListener(DISMISS_EVENT_NAME, onDismissUpdate);
    window.addEventListener("storage", onDismissUpdate);

    return () => {
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

  const handleToggleDedup = () => {
    setDedupByFilm((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DEDUP_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const toggleExpandFilm = (key: string) => {
    setExpandedFilms((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const blockedCount = useMemo(() => {
    return Object.keys(dismissStore.blocked || {}).length;
  }, [dismissStore]);

  // 过滤顺序：现有 type 筛选 / 搜索 → 不再推荐过滤 → 是否开启电影去重聚合 → 渲染。
  const grouped = useMemo((): GroupedTimelineItem[] => {
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

    if (!dedupByFilm) {
      if (filter !== "all" || q) {
        return afterDismiss.map((e) => ({ event: e, priorEvents: [] }));
      }
      const pinned = afterDismiss.filter((e) => e.type === "auteur").slice(0, PIN_NEW);
      const ids = new Set(pinned.map((e) => e.id));
      const list = [...pinned, ...afterDismiss.filter((e) => !ids.has(e.id))];
      return list.map((e) => ({ event: e, priorEvents: [] }));
    }

    // 开启「每片仅最新」：按电影唯一去重，最新一条作为主卡片，较早动态存入 priorEvents
    const filmMap = new Map<string, GroupedTimelineItem>();
    const result: GroupedTimelineItem[] = [];

    for (const e of afterDismiss) {
      const key = e.filmId;
      if (!key) {
        result.push({ event: e, priorEvents: [] });
        continue;
      }
      const existing = filmMap.get(key);
      if (!existing) {
        const item: GroupedTimelineItem = { event: e, priorEvents: [] };
        filmMap.set(key, item);
        result.push(item);
      } else {
        existing.priorEvents.push(e);
      }
    }

    return result;
  }, [events, filter, query, dismissStore, showBlocked, dedupByFilm]);

  const dayGroups = useMemo(
    () => groupByDay(grouped, (it) => it.event.date || ""),
    [grouped],
  );

  // Divider goes right after the last (oldest) new card in render order.
  const lastNewId = useMemo(() => {
    if (!baseline) return "";
    const flat = dayGroups.flatMap((g) => g.items);
    let idx = -1;
    flat.forEach((it, i) => {
      if (isCardNew(it.event)) idx = i;
    });
    // no divider when nothing older follows it
    if (idx < 0 || idx === flat.length - 1) return "";
    return flat[idx]!.event.id;
  }, [dayGroups, baseline, isCardNew]);

  const resumeItems = useMemo(
    () => events.map((e) => ({ id: e.id, title: e.headline || e.filmTitle })),
    [events],
  );

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: 0,
      nomination: 0,
      win: 0,
      streaming: 0,
      auteur: 0,
    };
    const seenMap: Record<FilterKey, Set<string>> = {
      all: new Set(),
      nomination: new Set(),
      win: new Set(),
      streaming: new Set(),
      auteur: new Set(),
    };

    for (const e of events) {
      if (!isBlockedOrSimilar(e, dismissStore)) {
        if (dedupByFilm) {
          const key = e.filmId || e.id;
          if (!seenMap.all.has(key)) {
            seenMap.all.add(key);
            c.all += 1;
          }
          if (!seenMap[e.type].has(key)) {
            seenMap[e.type].add(key);
            c[e.type] += 1;
          }
        } else {
          c.all += 1;
          c[e.type] += 1;
        }
      }
    }
    return c;
  }, [events, dismissStore, dedupByFilm]);

  const renderItem = ({ event, priorEvents }: GroupedTimelineItem) => {
            const read = seen.includes(event.id);
            const isBlocked = isBlockedOrSimilar(event, dismissStore);
            const linkHref = event.filmId
              ? `/film/${encodeURIComponent(event.filmId)}`
              : `/event/${encodeURIComponent(event.id)}`;
            const groupKey = event.filmId || event.id;
            const hasPrior = priorEvents.length > 0;
            const isExpanded = Boolean(expandedFilms[groupKey]);

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
                        {isCardNew(event) ? (
                          <span className="rounded-full bg-cinema-gold px-1.5 py-px text-[10px] font-semibold leading-4 text-cinema-bg">
                            新
                          </span>
                        ) : null}
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
                        <div className="flex flex-wrap items-center gap-2">
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
                              <span className="ml-1 text-cinema-gold/70">影片档 →</span>
                            </Link>
                          ) : null}
                          <a
                            href={`https://guide.readcine.com/?q=${encodeURIComponent([event.filmTitle, event.filmYear, event.filmTitleEn, event.directors?.[0]].filter(Boolean).join(" "))}&pick=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-cinema-border/70 bg-cinema-card px-2 py-0.5 text-[10px] text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
                          >
                            <span>🎞️ 导赏</span>
                            <span className="text-[9px] opacity-70">↗</span>
                          </a>
                          <a
                            href={`https://movie.readcine.com/#/movie/${encodeURIComponent(event.filmTitle)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-cinema-border/70 bg-cinema-card px-2 py-0.5 text-[10px] text-cinema-muted transition hover:border-cinema-gold/40 hover:text-cinema-text"
                          >
                            <span>💾 找资源</span>
                            <span className="text-[9px] opacity-70">↗</span>
                          </a>
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

                      {hasPrior ? (
                        <div className="mt-3 border-t border-cinema-border/50 pt-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleExpandFilm(groupKey);
                            }}
                            className="group inline-flex items-center gap-1.5 text-xs text-cinema-muted hover:text-cinema-gold transition"
                          >
                            <span className="font-medium text-cinema-gold/90 group-hover:text-cinema-gold">
                              {isExpanded
                                ? "收起该片历史动态"
                                : `该片另有 ${priorEvents.length} 条动态`}
                            </span>
                            <span className="text-[10px] text-cinema-muted/60 transition group-hover:text-cinema-gold">
                              {isExpanded ? "▴" : "▾"}
                            </span>
                          </button>

                          {isExpanded ? (
                            <ul className="mt-2.5 space-y-2 border-l-2 border-cinema-gold/30 pl-3 pt-1">
                              {priorEvents.map((p) => {
                                const pRead = seen.includes(p.id);
                                const pLink = p.filmId
                                  ? `/film/${encodeURIComponent(p.filmId)}`
                                  : `/event/${encodeURIComponent(p.id)}`;
                                return (
                                  <li key={p.id} className="text-xs">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-cinema-muted">
                                      <time dateTime={p.date || undefined}>{p.dateLabel}</time>
                                      <TypeBadge type={p.type} label={displayBadge(p.badge)} />
                                    </div>
                                    <Link
                                      href={pLink}
                                      prefetch={false}
                                      onClick={() => markClicked(p.id)}
                                      className={`mt-0.5 block hover:text-cinema-gold transition ${
                                        pRead
                                          ? "text-cinema-muted/70"
                                          : "text-cinema-text/90 font-normal"
                                      }`}
                                    >
                                      {p.headline || p.summary}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            );
  };

  return (
    <div className="space-y-6">
      <ResumeBar
        items={resumeItems}
        newSince={ready ? { hasBaseline: Boolean(baseline), count: newSinceCount } : null}
      />
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
                    ? "bg-cinema-gold text-cinema-bg font-medium"
                    : "border border-cinema-border text-cinema-muted hover:border-cinema-gold/40 hover:text-cinema-text"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${active ? "opacity-75" : "opacity-50"}`}>
                  {counts[f.key]}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleToggleDedup}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition inline-flex items-center gap-1.5 ${
              dedupByFilm
                ? "border border-cinema-gold/60 bg-cinema-gold/15 text-cinema-gold hover:bg-cinema-gold/25"
                : "border border-cinema-border text-cinema-muted hover:border-cinema-gold/40 hover:text-cinema-text"
            }`}
            title={
              dedupByFilm
                ? "每部电影仅显示最新动态（已开启），点击查看全部细分条目"
                : "显示所有历史动态（已开启），点击按电影去重聚合"
            }
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                dedupByFilm ? "bg-cinema-gold" : "bg-cinema-muted/40"
              }`}
            />
            {dedupByFilm ? "每片仅最新" : "全部动态"}
          </button>

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

      {grouped.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cinema-border px-4 py-10 text-center text-sm text-cinema-muted">
          没有匹配的时间线事件
        </p>
      ) : (
        <div className="space-y-12 sm:space-y-14">
          {dayGroups.map((g) => {
            const lastNewInDay = g.items.some((it) => it.event.id === lastNewId);
            const dividerAfterGroup =
              lastNewInDay && g.items[g.items.length - 1]!.event.id === lastNewId;
            const rel = today ? relativeDayPrefix(g.day, today) : "";
            const abs = absoluteDayLabel(g.day, (today || "").slice(0, 4) || undefined);
            const newInDay = baseline
              ? g.items.filter((it) => isCardNew(it.event)).length
              : 0;
            return (
              <section key={g.day} aria-label={abs} data-day={g.day}>
                <header className="sticky top-[57px] z-20 -mx-4 mb-4 bg-cinema-bg/85 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6">
                  <div className="flex items-baseline justify-between gap-3 border-b border-cinema-border/70 pb-2">
                    <h2 className="flex items-baseline gap-2 text-[1.15rem] font-semibold tracking-tight text-cinema-text sm:text-xl">
                      {rel ? <span className="text-cinema-gold">{rel}</span> : null}
                      {rel ? <span className="text-cinema-muted/50">·</span> : null}
                      <span>{abs}</span>
                    </h2>
                    <span className="shrink-0 text-xs tabular-nums text-cinema-muted">
                      {newInDay > 0 ? (
                        <span className="mr-2 font-medium text-cinema-gold">{newInDay} 条新</span>
                      ) : null}
                      {g.items.length} 条
                    </span>
                  </div>
                </header>
                <ol className="relative space-y-0 border-l border-cinema-border pl-6 sm:pl-8">
                  {g.items.map((it) => (
                    <Fragment key={it.event.id}>
                      {renderItem(it)}
                      {it.event.id === lastNewId && !dividerAfterGroup ? (
                        <li className="list-none pb-8">
                          <LastSeenDivider />
                        </li>
                      ) : null}
                    </Fragment>
                  ))}
                </ol>
                {dividerAfterGroup ? (
                  <div className="mt-10">
                    <LastSeenDivider />
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
