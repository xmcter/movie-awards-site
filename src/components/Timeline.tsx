"use client";

import { publicationTime } from "@/lib/timelineOrder";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReleaseLabel from "@/components/ReleaseLabel";
import FilmMeta from "@/components/FilmMeta";
import WeiboLink from "@/components/WeiboLink";
import type { TimelineEvent, TimelineEventType } from "@/types";
import { TypeBadge } from "@/components/Badge";
import {
  getVisitBaseline,
  isNewSince,
  writeLastSeen,
  type LastSeenMarker,
} from "@/lib/lastSeen";
import { absoluteDayLabel, absoluteDayLabelEn, groupByDay, relativeDayPrefix, relativeDayPrefixEn, shanghaiToday } from "@/lib/dayGroups";
import { markClicked, readClicked } from "@/lib/readProgress";
import {
  DISMISS_EVENT_NAME,
  blockEvent,
  clearDismissMarks,
  isBlockedOrSimilar,
  isSimilarMark,
  loadDismissMarks,
  mergeCloudDismiss,
  saveDismissMarks,
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
import { dedupeSubtitleAgainstTitleEn } from "@/lib/headlines-en";
import { useShowSources } from "@/components/ShowSources";
import { cleanGuideDirector, type Locale } from "@/lib/i18n";




function SourceTag({
  label,
  href,
  publishedLabel,
  locale = "zh",
}: {
  label?: string;
  href?: string;
  publishedLabel?: string;
  locale?: Locale;
}) {
  // Source attributions are private: only render on devices where the
  // sources switch is on (?show-sources=1, stored in localStorage).
  const showSources = useShowSources();
  if (!showSources) return null;
  if (!label && !publishedLabel) return null;
  const text = [label ? `${locale === "en" ? "Source" : "来源"}·${label}` : null, publishedLabel].filter(Boolean).join(" · ");
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
  priority = false,
}: {
  event: TimelineEvent;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const colors = event.posterColors || ["#1a1a2e", "#334155"];
  const showImg = Boolean(event.poster) && !failed;

  return (
    <div
      className={className}
      style={{
        background: colors[0],
        aspectRatio: "2 / 3",
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.poster?.startsWith("/posters/") ? `/thumbs/${event.poster.split("/").pop()!.replace(/\.[^.]+$/, "")}.webp` : event.poster}
          alt={event.filmTitle}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
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

function LastSeenDivider({ locale = "zh" }: { locale?: Locale }) {
  return (
    <div
      data-last-seen-divider
      role="separator"
      aria-label={locale === "en" ? "Last seen here" : "上次看到这里"}
      className="flex items-center gap-3 text-xs font-medium tracking-wide text-cinema-gold"
    >
      <span className="h-px flex-1 bg-cinema-gold/45" />
      <span>{locale === "en" ? "— You were here —" : "— 上次看到这里 —"}</span>
      <span className="h-px flex-1 bg-cinema-gold/45" />
    </div>
  );
}

function displayBadge(label?: string) {
  return label === "新品" ? "新片" : label;
}

export default function Timeline({ events, locale = "zh" }: { events: TimelineEvent[]; locale?: Locale }) {
  const en = locale === "en";
  const dedupe = en ? dedupeSubtitleAgainstTitleEn : dedupeSubtitleAgainstTitle;
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
          // 并集：云端 + 本机，避免匿名本机记录被冲掉；本机已撤销的 id
          // 不再被云端盖回来（见 mergeCloudDismiss）。
          const mergedBlocked = mergeCloudDismiss(cloud.blocked, loadDismissMarks().blocked);
          const mergedLiked = { ...cloud.liked, ...loadLikeMarks() };
          setDismissStore({ blocked: mergedBlocked });
          setLiked(mergedLiked);
          setLikeMarks(mergedLiked);
          // 云端有额外项时写回本机，便于离线一致；不主动覆盖本机已有 reason。
          saveDismissMarks({ blocked: mergedBlocked });
        })
        .catch(() => {
          setPrefsError(en ? "Cloud preferences failed to load; showing local records only" : "云端偏好读取失败，仅显示本机记录");
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
        const mergedBlocked = mergeCloudDismiss(cloud.blocked, loadDismissMarks().blocked);
        const mergedLiked = { ...cloud.liked, ...loadLikeMarks() };
        setDismissStore({ blocked: mergedBlocked });
        setLiked(mergedLiked);
        setLikeMarks(mergedLiked);
        saveDismissMarks({ blocked: mergedBlocked });
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
        message: en ? `Blocked "${title}" and similar items` : `已屏蔽「${title}」及类似条目`,
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
      setPrefsError(en ? "Cloud sync failed: saved locally, not synced to other devices" : "云端同步失败：本机已生效，未同步到其他设备");
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
      setPrefsError(en ? "Cloud sync failed: like saved locally, not synced to other devices" : "云端同步失败：点赞已记在本机，未同步到其他设备");
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
      setPrefsError(en ? "Cloud sync failed: undo saved locally, not synced to other devices" : "云端同步失败：本机已撤销，未同步到其他设备");
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
      setPrefsError(en ? "Cloud sync failed: cleared locally, not synced to other devices" : "云端同步失败：本机已清除，未同步到其他设备");
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

  // 按天分组的标题：相对（今天/昨天）+ 绝对日期，中英文各一套。
  const today = shanghaiToday();
  const currentYear = today.slice(0, 4);
  const dayLabelFor = useCallback(
    (day: string): string => {
      if (en) {
        const rel = relativeDayPrefixEn(day, today);
        const abs = absoluteDayLabelEn(day, currentYear);
        return rel ? `${rel} · ${abs}` : abs;
      }
      const rel = relativeDayPrefix(day, today);
      const abs = absoluteDayLabel(day, currentYear);
      return rel ? `${rel} · ${abs}` : abs;
    },
    [en, today, currentYear],
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
              ? `${en ? "/en" : ""}/film/${encodeURIComponent(event.filmId)}`
              : `${en ? "/en" : ""}/event/${encodeURIComponent(event.id)}`;
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
                      className="m-3 mr-0 h-[108px] w-[72px] shrink-0 overflow-hidden rounded-md sm:m-4 sm:h-[126px] sm:w-[84px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cinema-gold"
                    >
                      <EventPoster event={event} priority={event.id === events[0]?.id} className="h-full w-full" />
                    </Link>
                    <div className="min-w-0 flex-1 p-3 pl-3 sm:p-5 sm:pl-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
                        <TypeBadge type={event.type} label={displayBadge(event.badge)} headline={event.headline} locale={locale} />
                        <SourceTag label={event.sourceLabel} href={event.sourceUrl} publishedLabel={event.sourcePublishedLabel} locale={locale} />
                        {isCardNew(event) ? (
                          <span className="rounded-full bg-cinema-gold px-1.5 py-px text-[10px] font-semibold leading-4 text-cinema-bg">
                            {en ? "New" : "新"}
                          </span>
                        ) : null}
                        {isBlocked ? (
                          <span className="rounded bg-cinema-elevated px-1.5 py-0.5 text-[10px] text-cinema-gold">
                            {en ? "Blocked" : "已屏蔽"}
                          </span>
                        ) : null}
                      </div>
                      <Link
                        href={linkHref}
                        prefetch={false}
                        onClick={() => markClicked(event.id)}
                        className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-cinema-gold"
                      >
                        <h2 className="mt-2 font-display text-[1.05rem] leading-snug text-cinema-text group-hover:text-cinema-gold-light sm:text-lg">
                          {event.type === "streaming" && event.date ? <ReleaseLabel date={event.date} title={event.filmTitle} fallback={event.headline || event.filmTitle} locale={locale} /> : (event.headline || event.summary || event.filmTitle)}
                        </h2>
                        {(() => {
                          const sub = en
                            ? dedupe(event.headline || event.filmTitle || "", event.summary || "")
                            : scrubNegativeCopy(
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
                      {event.plot && dedupe(event.summary || "", event.plot) ? (
                        <p data-film-plot className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-cinema-muted">
                          {event.plot}
                        </p>
                      ) : null}
                      </Link>
                      {event.filmAwards?.length ? (
                        <ul data-film-awards className="mt-3 space-y-1 break-words text-xs leading-relaxed text-cinema-gold/90">
                          {event.filmAwards.map(award => (
                            <li key={`${award.year}-${award.festival}-${award.category}-${award.result}`}>
                              <a href={award.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {award.icon ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={award.icon} alt={en ? `${award.festivalEn || award.festival} logo` : `${award.festival}标识`} width={16} height={16} className="mr-1.5 inline-block h-4 w-4 shrink-0 rounded-sm bg-white p-px align-text-bottom object-contain" />
                                ) : null}
                                {en ? `${award.year} ${award.festivalEn || award.festival} · ${award.categoryEn || award.category} · ${award.result === "won" ? "Won" : "Nominated"}` : `${award.year}年${award.festival} · ${award.category} · ${award.result === "won" ? "获奖" : "提名"}`}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cinema-muted">
                        <div className="flex flex-wrap items-center gap-2">
                          {event.filmId ? (
                            <Link
                              href={`${en ? "/en" : ""}/film/${encodeURIComponent(event.filmId)}`}
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

                                if (event.directors?.[0] && !hl.includes(event.directors[0].toLowerCase())) {
                                  bits.push(event.directors[0]);
                                }
                                return bits.length ? (
                                  <>
                                    <FilmMeta year={!yearHit ? event.filmYear : undefined} parts={bits} />
                                    <span className="ml-1 text-cinema-gold">{en ? "Film page →" : "影片档 →"}</span>
                                  </>
                                ) : (
                                  <><FilmMeta year={!yearHit ? event.filmYear : undefined} /><span className="ml-1 text-cinema-gold">{en ? "Film page →" : "影片档 →"}</span></>
                                );
                              })()}
                            </Link>
                          ) : null}
                          <a
                            href={`https://guide.readcine.com/?q=${encodeURIComponent([event.filmTitle, event.filmYear, event.filmTitleEn, cleanGuideDirector(event.directors?.[0])].filter(Boolean).join(" "))}&pick=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-cinema-border/70 bg-cinema-card px-2 py-0.5 text-[10px] text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
                          >
                            <span>{en ? "🎞️ Guide" : "🎞️ 导赏"}</span>
                            <span className="text-[9px] opacity-70">↗</span>
                          </a>
                          <WeiboLink href={event.weiboUrl} label={event.weiboLabel} locale={locale} />
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
                            title={liked[event.id] ? (en ? "Unlike" : "取消点赞") : (en ? "Like" : "点赞")}
                          >
                            {liked[event.id] ? (en ? "👍 Liked" : "👍 已点赞") : (en ? "👍 Like" : "👍 点赞")}
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
                            title={isBlocked ? (en ? "Unblock this and related items" : "撤销屏蔽本条及相关条目") : (en ? "Don\'t recommend this or similar items" : "不再推荐本条及类似内容")}
                          >
                            {isBlocked ? (en ? "↩ Unblock" : "↩ 撤销屏蔽") : (en ? "✕ Not interested" : "✕ 不再推荐")}
                          </button>
                        </div>
                        {blockReason ? (
                          <p className="mt-2 text-xs text-cinema-muted">
                            {en ? "Not interested because: " : "不再推荐原因："}{blockReason}
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
                                ? (en ? "Collapse this film's history" : "收起该片历史动态")
                                : (en ? `${priorEvents.length} more update${priorEvents.length === 1 ? "" : "s"} for this film` : `该片另有 ${priorEvents.length} 条动态`)}
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
                                  ? `${en ? "/en" : ""}/film/${encodeURIComponent(p.filmId)}`
                                  : `${en ? "/en" : ""}/event/${encodeURIComponent(p.id)}`;
                                return (
                                  <li key={p.id} className="text-xs">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-cinema-muted">
                                      <TypeBadge type={p.type} label={displayBadge(p.badge)} headline={p.headline} locale={locale} />
                                      <SourceTag label={p.sourceLabel} href={p.sourceUrl} publishedLabel={p.sourcePublishedLabel} locale={locale} />
                                      <WeiboLink href={p.weiboUrl} label={p.weiboLabel} locale={locale} />
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
                                      {p.type === "streaming" && p.date ? <ReleaseLabel date={p.date} title={p.filmTitle} fallback={p.headline || p.filmTitle} locale={locale} /> : (p.headline || p.summary)}
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
              <span>{en ? `Blocked ${blockedCount}` : `已屏蔽 ${blockedCount} 条`}</span>
              <button
                type="button"
                onClick={() => setShowBlocked((s) => !s)}
                className="ml-1 text-cinema-muted hover:text-cinema-gold underline underline-offset-2 transition"
              >
                {showBlocked ? (en ? "Hide blocked" : "隐藏已屏蔽") : (en ? "View" : "查看")}
              </button>
              <span className="text-cinema-border">·</span>
              <button
                type="button"
                onClick={() => void handleClearAll()}
                className="text-cinema-gold hover:underline transition"
              >
                {en ? "Clear all blocks" : "清除不再推荐"}
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
            {en ? "↩ Undo" : "↩ 撤销"}
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
            {en ? "Got it" : "知道了"}
          </button>
        </div>
      ) : null}

      {grouped.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cinema-border px-4 py-10 text-center text-sm text-cinema-muted">
          {en ? "No timeline events match" : "没有匹配的时间线事件"}
        </p>
      ) : (
        <div className="space-y-12 sm:space-y-14">
          {dayGroups.map((g) => {
            const lastNewInDay = g.items.some((it) => it.event.id === lastNewId);
            const dividerAfterGroup =
              lastNewInDay && g.items[g.items.length - 1]!.event.id === lastNewId;
            const dayLabel = dayLabelFor(g.day);
            return (
              <section key={g.day} aria-label={dayLabel} data-day={g.day}>
                <h2 className="mb-4 font-display text-base text-cinema-text sm:text-lg">{dayLabel}</h2>
                <ol className="relative space-y-0 border-l border-cinema-border pl-6 sm:pl-8">
                  {g.items.map((it) => (
                    <Fragment key={it.event.id}>
                      {renderItem(it)}
                      {it.event.id === lastNewId && !dividerAfterGroup ? (
                        <li className="list-none pb-8">
                          <LastSeenDivider locale={locale} />
                        </li>
                      ) : null}
                    </Fragment>
                  ))}
                </ol>
                {dividerAfterGroup ? (
                  <div className="mt-10">
                    <LastSeenDivider locale={locale} />
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
              {en ? "Don't recommend this?" : "不再推荐这条？"}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-cinema-muted">
              {reasonTarget.headline || reasonTarget.filmTitle}
            </p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder={en ? "Tell us why — e.g. not my genre, already seen, want something different…" : "说说原因，比如：题材不感兴趣、已经看过、想换个风格……"}
              autoFocus
              rows={6}
              className="mt-4 w-full resize-y rounded-xl border border-cinema-border/70 bg-cinema-elevated/40 px-4 py-3 text-base leading-relaxed text-cinema-text placeholder:text-cinema-muted/60 focus:border-cinema-gold/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cinema-gold min-h-[160px]"
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
                {en ? "Cancel" : "取消"}
              </button>
              <button
                type="button"
                disabled={!reasonText.trim()}
                onClick={() => void confirmDismissWithReason()}
                className="rounded-full border border-cinema-gold/40 bg-cinema-gold/15 px-4 py-2.5 text-sm font-medium text-cinema-gold disabled:opacity-40"
              >
                {en ? "Confirm" : "确认不再推荐"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
