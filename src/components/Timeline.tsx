"use client";

import { publicationTime } from "@/lib/timelineOrder";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReleaseLabel from "@/components/ReleaseLabel";
import WeiboLink from "@/components/WeiboLink";
import type { TimelineEvent, TimelineEventType } from "@/types";
import { TypeBadge } from "@/components/Badge";
import {
  getVisitBaseline,
  isNewSince,
  writeLastSeen,
  type LastSeenMarker,
} from "@/lib/lastSeen";
import { groupByDay } from "@/lib/dayGroups";
import { markClicked, readClicked } from "@/lib/readProgress";
import {
  DISMISS_EVENT_NAME,
  blockEvent,
  clearDismissMarks,
  isBlockedOrSimilar,
  isSimilarMark,
  loadDismissMarks,
  unblockEvent,
  type DismissStore,
} from "@/lib/dismiss";
import {
  cloudBlock,
  cloudClearBlocked,
  cloudLike,
  cloudUnblock,
  cloudUnlike,
  fetchCloudPrefs,
  loadPrefsSession,
  syncLocalBlockedToCloud,
  type PrefsSession,
} from "@/lib/prefs";
import {
  LIKE_EVENT_NAME,
  loadLikeMarks,
  setLikeMarks,
  toggleLikeEvent,
  type LikeMark,
} from "@/lib/likes";
import { dedupeSubtitleAgainstTitle, scrubNegativeCopy } from "@/lib/headlines";




function SourceTag({
  label,
  href,
  publishedLabel,
}: {
  label?: string;
  href?: string;
  publishedLabel?: string;
}) {
  if (!label && !publishedLabel) return null;
  const text = [label ? `来源·${label}` : null, publishedLabel].filter(Boolean).join(" · ");
  const className =
    "rounded-full border border-cinema-border/60 bg-cinema-elevated/50 px-1.5 py-px text-[10px] tracking-wide text-cinema-muted";
  if (href && label) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} hover:border-cinema-gold/30 hover:text-cinema-gold transition`}
        title={href}
        onClick={(e) => e.stopPropagation()}
        data-source-label={label}
      >
        {text}
      </a>
    );
  }
  return (
    <span className={className} data-source-label={label || ""}>
      {text}
    </span>
  );
}


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
          width={168}
          height={252}
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
  // 首页只留时间线：筛选与搜索已去掉，固定为全部、不过滤。
  const filter = "all";
  const query = "";
  const [seen, setSeen] = useState<string[]>([]);
  const [dismissStore, setDismissStore] = useState<DismissStore>({ blocked: {} });
  const [reasonTarget, setReasonTarget] = useState<TimelineEvent | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [liked, setLiked] = useState<Record<string, LikeMark>>({});
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const prefsMergedRef = useRef(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [lastUndo, setLastUndo] = useState<{ event: TimelineEvent; message: string } | null>(null);
  const [ready, setReady] = useState(false);
  // 首页只留时间线：去重开关已去掉，固定每片仅最新。
  const dedupByFilm = true;
  const [expandedFilms, setExpandedFilms] = useState<Record<string, boolean>>({});
  const [baseline, setBaseline] = useState<LastSeenMarker | null>(null);
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
    setReady(true);

    // 本机点赞 / 屏蔽始终可用；仅当已有会话时静默回填云端，绝不弹登录。
    const initialLikes = loadLikeMarks();
    setLiked(initialLikes);
    const existingSession = loadPrefsSession();
    if (existingSession) {
      prefsMergedRef.current = true;
      fetchCloudPrefs(existingSession)
        .then((cloud) => {
          // 并集：云端 + 本机，避免匿名本机记录被冲掉。
          const mergedBlocked = {
            ...cloud.blocked,
            ...loadDismissMarks().blocked,
          };
          const mergedLiked = { ...cloud.liked, ...loadLikeMarks() };
          setDismissStore({ blocked: mergedBlocked });
          setLiked(mergedLiked);
          setLikeMarks(mergedLiked);
          // 本机 dismiss 已在 load 时读过；若云端有额外项，写回本机便于离线一致。
          // 不主动覆盖本机已有 reason。
        })
        .catch(() => {
          setPrefsError("云端偏好读取失败，仅显示本机记录");
        });
    }

    const onDismissUpdate = () => {
      setDismissStore(loadDismissMarks());
    };
    const onLikeUpdate = () => {
      setLiked(loadLikeMarks());
    };
    window.addEventListener(DISMISS_EVENT_NAME, onDismissUpdate);
    window.addEventListener(LIKE_EVENT_NAME, onLikeUpdate);
    window.addEventListener("storage", onDismissUpdate);
    window.addEventListener("storage", onLikeUpdate);

    return () => {
      window.removeEventListener(DISMISS_EVENT_NAME, onDismissUpdate);
      window.removeEventListener(LIKE_EVENT_NAME, onLikeUpdate);
      window.removeEventListener("storage", onDismissUpdate);
      window.removeEventListener("storage", onLikeUpdate);
    };
  }, []);

  /** 仅在已有会话时静默同步；没有会话直接返回 null，绝不弹谷歌登录。 */
  const tryExistingSessionSync = async (): Promise<PrefsSession | null> => {
    const session = loadPrefsSession();
    if (!session) return null;
    if (!prefsMergedRef.current) {
      prefsMergedRef.current = true;
      try {
        await syncLocalBlockedToCloud(session, loadDismissMarks(), loadLikeMarks());
        const cloud = await fetchCloudPrefs(session);
        const mergedBlocked = {
          ...cloud.blocked,
          ...loadDismissMarks().blocked,
        };
        const mergedLiked = { ...cloud.liked, ...loadLikeMarks() };
        setDismissStore({ blocked: mergedBlocked });
        setLiked(mergedLiked);
        setLikeMarks(mergedLiked);
      } catch {
        // 合并失败不阻塞本次本机操作。
      }
    }
    return session;
  };

  const cloudUnblockForEvent = async (
    session: PrefsSession,
    event: TimelineEvent,
    store: DismissStore,
  ) => {
    const ids = Object.entries(store.blocked || {})
      .filter(
        ([id, mark]) => id === event.id || isSimilarMark(event, mark),
      )
      .map(([id]) => id);
    for (const id of ids) {
      await cloudUnblock(session, id);
    }
  };

  const handleToggleDismiss = async (event: TimelineEvent, reason?: string) => {
    const isBlocked = isBlockedOrSimilar(event, dismissStore);
    // 本机先生效；仅当已有会话时静默写云端，绝不弹登录。
    const prevStore = dismissStore;
    if (isBlocked) {
      const updated = unblockEvent(event, dismissStore);
      setDismissStore(updated);
      setLastUndo(null);
    } else {
      const updated = blockEvent(event, dismissStore, reason);
      setDismissStore(updated);
      const title = event.headline || event.filmTitle;
      setLastUndo({
        event,
        message: `已屏蔽「${title}」及类似条目`,
      });
    }
    try {
      const session = await tryExistingSessionSync();
      if (!session) return;
      if (isBlocked) {
        await cloudUnblockForEvent(session, event, prevStore);
      } else {
        await cloudBlock(session, event, reason);
      }
      setDismissStore(loadDismissMarks());
      setPrefsError(null);
    } catch {
      setPrefsError("云端同步失败：本机已生效，未同步到其他设备");
    }
  };

  const confirmDismissWithReason = async () => {
    if (!reasonTarget) return;
    const reason = reasonText.trim();
    if (!reason) return;
    const ev = reasonTarget;
    setReasonTarget(null);
    setReasonText("");
    await handleToggleDismiss(ev, reason);
  };

  const handleToggleLike = async (event: TimelineEvent) => {
    const isLiked = Boolean(liked[event.id]);
    // 本机持久化先生效；仅当已有会话时静默写云端，绝不弹登录。
    const next = toggleLikeEvent(event, liked);
    setLiked(next);
    try {
      const session = await tryExistingSessionSync();
      if (!session) return;
      if (isLiked) await cloudUnlike(session, event.id);
      else await cloudLike(session, event);
      setLiked(next);
      setLikeMarks(next);
      setPrefsError(null);
    } catch {
      setPrefsError("云端同步失败：点赞已记在本机，未同步到其他设备");
    }
  };

  const handleUndo = async () => {
    if (!lastUndo) return;
    const event = lastUndo.event;
    const session = loadPrefsSession();
    const updated = unblockEvent(event, dismissStore);
    setDismissStore(updated);
    setLastUndo(null);
    if (!session) return;
    try {
      await cloudUnblockForEvent(session, event, dismissStore);
      setPrefsError(null);
    } catch {
      setPrefsError("云端同步失败：本机已撤销，未同步到其他设备");
    }
  };

  const handleClearAll = async () => {
    const updated = clearDismissMarks();
    setDismissStore(updated);
    setShowBlocked(false);
    setLastUndo(null);
    // 清除同步写云端 /clear（点赞不动）；没有会话时不弹登录，只清本机。
    const session = loadPrefsSession();
    if (!session) return;
    try {
      await cloudClearBlocked(session);
      setPrefsError(null);
    } catch {
      setPrefsError("云端同步失败：本机已清除，未同步到其他设备");
    }
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

  // 过滤顺序：不再推荐过滤 → 电影去重聚合 → 渲染（筛选与搜索已去掉）。
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
      return afterDismiss.map((e) => ({ event: e, priorEvents: [] }));
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
    () => groupByDay(grouped, (it) => publicationTime(it.event).slice(0, 10)),
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

  const renderItem = ({ event, priorEvents }: GroupedTimelineItem) => {
            const read = seen.includes(event.id);
            const isBlocked = isBlockedOrSimilar(event, dismissStore);
            const linkHref = event.filmId
              ? `/film/${encodeURIComponent(event.filmId)}`
              : `/event/${encodeURIComponent(event.id)}`;
            const groupKey = event.filmId || event.id;
            const hasPrior = priorEvents.length > 0;
            const isExpanded = Boolean(expandedFilms[groupKey]);
            const ownMark = dismissStore.blocked[event.id];
            const similarMark =
              ownMark ??
              Object.values(dismissStore.blocked || {}).find((m) =>
                isSimilarMark(event, m),
              );
            const blockReason = similarMark?.reason;

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
                        <TypeBadge type={event.type} label={displayBadge(event.badge)} headline={event.headline} />
                        <SourceTag label={event.sourceLabel} href={event.sourceUrl} publishedLabel={event.sourcePublishedLabel} />
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
                          {event.type === "streaming" && event.date ? <ReleaseLabel date={event.date} title={event.filmTitle} fallback={event.headline || event.filmTitle} /> : (event.headline || event.summary || event.filmTitle)}
                        </h2>
                        {(() => {
                          const sub = scrubNegativeCopy(
                            dedupeSubtitleAgainstTitle(
                              event.headline || event.filmTitle || "",
                              event.summary || "",
                            ),
                          );
                          return sub ? (
                            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-cinema-muted">
                              {sub}
                            </p>
                          ) : null;
                        })()}
                      </Link>
                      {event.plot && dedupeSubtitleAgainstTitle(event.summary || "", event.plot) ? (
                        <p data-film-plot className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-cinema-muted">
                          {event.plot}
                        </p>
                      ) : null}
                      {event.filmAwards?.length ? (
                        <ul data-film-awards className="mt-3 space-y-1 break-words text-xs leading-relaxed text-cinema-gold/90">
                          {event.filmAwards.map(award => (
                            <li key={`${award.year}-${award.festival}-${award.category}-${award.result}`}>
                              <a href={award.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {award.year}年{award.festival} · {award.category} · {award.result === "won" ? "获奖" : "提名"}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cinema-muted">
                        <div className="flex flex-wrap items-center gap-2">
                          {event.filmId ? (
                            <Link
                              href={`/film/${encodeURIComponent(event.filmId)}`}
                              prefetch={false}
                              onClick={() => markClicked(event.id)}
                              className="hover:text-cinema-gold transition"
                            >
                              {(() => {
                                // 底栏不再复读标题已有的片名/年份；只补导演等增量，否则只留「影片档」
                                const hl = (event.headline || "").toLowerCase();
                                const titleHit =
                                  Boolean(event.filmTitle) &&
                                  (hl.includes(event.filmTitle.toLowerCase()) ||
                                    hl.includes(`《${event.filmTitle}》`.toLowerCase()));
                                const yearHit =
                                  Boolean(event.filmYear) &&
                                  hl.includes(String(event.filmYear));
                                const bits: string[] = [];
                                if (!titleHit && event.filmTitle) bits.push(event.filmTitle);
                                if (!yearHit && event.filmYear) bits.push(String(event.filmYear));
                                if (event.directors?.[0] && !hl.includes(event.directors[0].toLowerCase())) {
                                  bits.push(event.directors[0]);
                                }
                                return bits.length ? (
                                  <>
                                    {bits.join(" · ")}
                                    <span className="ml-1 text-cinema-gold">影片档 →</span>
                                  </>
                                ) : (
                                  <span className="text-cinema-gold">影片档 →</span>
                                );
                              })()}
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
                          <WeiboLink href={event.weiboUrl} label={event.weiboLabel} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleToggleLike(event);
                            }}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition active:scale-95 ${
                              liked[event.id]
                                ? "border border-cinema-gold/40 bg-cinema-gold/10 text-cinema-gold hover:bg-cinema-gold/20"
                                : "border border-cinema-border/60 text-cinema-muted/70 hover:border-cinema-gold/40 hover:text-cinema-text hover:bg-cinema-elevated"
                            }`}
                            title={liked[event.id] ? "取消点赞" : "点赞：以后多推类似方向"}
                          >
                            {liked[event.id] ? "👍 已点赞" : "👍 点赞"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isBlocked) {
                                void handleToggleDismiss(event);
                              } else {
                                setReasonTarget(event);
                                setReasonText("");
                              }
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
                        {blockReason ? (
                          <p className="mt-2 text-xs text-cinema-muted">
                            不再推荐原因：{blockReason}
                          </p>
                        ) : null}
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
                                      <TypeBadge type={p.type} label={displayBadge(p.badge)} headline={p.headline} />
                                      <SourceTag label={p.sourceLabel} href={p.sourceUrl} publishedLabel={p.sourcePublishedLabel} />
                                      <WeiboLink href={p.weiboUrl} label={p.weiboLabel} />
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
                                      {p.type === "streaming" && p.date ? <ReleaseLabel date={p.date} title={p.filmTitle} fallback={p.headline || p.filmTitle} /> : (p.headline || p.summary)}
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
                onClick={() => void handleClearAll()}
                className="text-cinema-gold hover:underline transition"
              >
                清除不再推荐
              </button>
            </div>
          ) : null}

      {lastUndo ? (
        <div className="flex items-center justify-between rounded-xl border border-cinema-gold/30 bg-cinema-card px-4 py-2.5 text-xs text-cinema-text">
          <span className="line-clamp-1">{lastUndo.message}</span>
          <button
            type="button"
            onClick={() => void handleUndo()}
            className="ml-3 shrink-0 font-medium text-cinema-gold hover:underline"
          >
            ↩ 撤销
          </button>
        </div>
      ) : null}

      {prefsError ? (
        <div className="flex items-center justify-between rounded-xl border border-cinema-border bg-cinema-card px-4 py-2.5 text-xs text-cinema-text">
          <span className="line-clamp-2">{prefsError}</span>
          <button
            type="button"
            onClick={() => setPrefsError(null)}
            className="ml-3 shrink-0 font-medium text-cinema-gold hover:underline"
          >
            知道了
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
            return (
              <section key={g.day} aria-label="消息列表" data-day={g.day}>
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

      {reasonTarget ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onClick={() => {
            setReasonTarget(null);
            setReasonText("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setReasonTarget(null);
              setReasonText("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-dismiss-reason-title"
            className="w-full max-w-lg rounded-2xl border border-cinema-border bg-cinema-card p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="news-dismiss-reason-title"
              className="font-display text-lg text-cinema-text"
            >
              不再推荐这条？
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-cinema-muted">
              {reasonTarget.headline || reasonTarget.filmTitle}
            </p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="说说原因，比如：题材不感兴趣、已经看过、想换个风格……"
              autoFocus
              rows={6}
              className="mt-4 w-full resize-y rounded-xl border border-cinema-border/70 bg-cinema-elevated/40 px-4 py-3 text-base leading-relaxed text-cinema-text placeholder:text-cinema-muted/60 focus:border-cinema-gold/60 focus:outline-none min-h-[160px]"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReasonTarget(null);
                  setReasonText("");
                }}
                className="rounded-full border border-cinema-border/70 px-4 py-2.5 text-sm text-cinema-muted hover:text-cinema-text"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!reasonText.trim()}
                onClick={() => void confirmDismissWithReason()}
                className="rounded-full border border-cinema-gold/40 bg-cinema-gold/15 px-4 py-2.5 text-sm font-medium text-cinema-gold disabled:opacity-40"
              >
                确认不再推荐
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
