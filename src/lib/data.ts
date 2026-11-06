import fs from "fs";
import { comparePublicationTime, publicationTime } from "@/lib/timelineOrder";
import path from "path";
import filmsData from "@/data/films.json";
import orgsData from "@/data/orgs.json";
import ceremoniesData from "@/data/ceremonies.json";
import auteurNewsData from "@/data/auteur-news.json";
import majorAwardsData from "@/data/major-awards.json";
import moreCatalogData from "@/data/more-catalog.json";
import extraCatalogData from "@/data/extra-catalog.json";
import densityPackData from "@/data/density-pack.json";
import wtsStreamingCatalogData from "@/data/wts-streaming-catalog.json";
import wonStreamingCatalogData from "@/data/won-streaming-catalog.json";
import motnStreamingCatalogData from "@/data/motn-streaming-catalog.json";
import moviePeekCatalogData from "@/data/movie-peek-catalog.json";
import densityCeremoniesData from "@/data/density-ceremonies.json";
import filmCopyData from "@/data/film-copy.json";
import posterUrlsData from "@/data/poster-urls.json";
import type {
  AwardCeremony,
  AwardOrg,
  AuteurNews,
  CategoryNomination,
  Film,
  FilmKind,
  TimelineEvent,
} from "@/types";
import {
  PLATFORM_LABELS,
  RELEASE_STATUS_LABELS,
  formatDate,
  streamingSourceLabel,
} from "@/lib/labels";
import {
  buildAwardBody,
  buildAwardHeadline,
  buildStreamingBody,
  buildStreamingHeadline,
  dedupeSubtitleAgainstTitle,
  polishAuteurHeadline,
} from "@/lib/headlines";

type CatalogSlice = {
  orgs?: AwardOrg[];
  films: Film[];
  ceremonies: AwardCeremony[];
};

type FilmCopy = Partial<
  Pick<
    Film,
    | "title"
    | "titleEn"
    | "synopsis"
    | "background"
    | "directors"
    | "cast"
    | "genres"
    | "runtime"
    | "country"
  >
>;

const major = majorAwardsData as unknown as CatalogSlice;
const extra = moreCatalogData as unknown as CatalogSlice;
const moreExtra = extraCatalogData as unknown as CatalogSlice;
const density = densityPackData as unknown as CatalogSlice;
const wtsStreaming = wtsStreamingCatalogData as unknown as CatalogSlice;
const wonStreaming = wonStreamingCatalogData as unknown as CatalogSlice;
const motnStreaming = motnStreamingCatalogData as unknown as CatalogSlice;
const moviePeek = moviePeekCatalogData as unknown as CatalogSlice;
const densityCeremonies = densityCeremoniesData as AwardCeremony[];
const filmCopy = filmCopyData as Record<string, FilmCopy>;
const posterUrls = posterUrlsData as Record<string, string>;

/** Build-time inventory of committed posters under public/posters */
const LOCAL_POSTER_FILES = (() => {
  try {
    const dir = path.join(process.cwd(), "public", "posters");
    const map = new Map<string, string>();
    for (const name of fs.readdirSync(dir)) {
      const m = name.match(/^(.+)\.(jpe?g|png|webp)$/i);
      if (!m) continue;
      // Deterministically prefer optimized WebP when the original is retained.
      if (!map.has(m[1]!) || /\.webp$/i.test(name)) map.set(m[1]!, `/posters/${name}`);
    }
    return map;
  } catch {
    return new Map<string, string>();
  }
})();

function resolvePoster(film: Film): string | undefined {
  const disk = LOCAL_POSTER_FILES.get(film.id);
  if (disk) return disk;
  if (film.poster && film.poster.startsWith("/posters/")) return film.poster;
  // Prefer already-downloaded local over hotlinked remotes
  if (posterUrls[film.id] && LOCAL_POSTER_FILES.has(film.id)) {
    return LOCAL_POSTER_FILES.get(film.id);
  }
  return film.poster || posterUrls[film.id];
}

function applyCopy(film: Film): Film {
  const extraCopy = filmCopy[film.id];
  const local = resolvePoster(film);
  if (!extraCopy) return { ...film, poster: local };
  return {
    ...film,
    ...extraCopy,
    directors: extraCopy.directors ?? film.directors,
    cast: extraCopy.cast ?? film.cast,
    genres: extraCopy.genres ?? film.genres,
    country: extraCopy.country ?? film.country,
    runtime: extraCopy.runtime ?? film.runtime,
    poster: local,
  };
}

export const films = [
  ...(filmsData as Film[]),
  ...major.films,
  ...extra.films,
  ...moreExtra.films,
  ...density.films,
  ...wtsStreaming.films,
  ...wonStreaming.films,
  ...motnStreaming.films,
  ...moviePeek.films,
].map(applyCopy);
export const orgs = [...(orgsData as AwardOrg[]), ...(major.orgs ?? [])];
export const ceremonies = [
  ...(ceremoniesData as AwardCeremony[]),
  ...major.ceremonies,
  ...extra.ceremonies,
  ...moreExtra.ceremonies,
  ...(density.ceremonies || []),
  ...densityCeremonies,
];
export const auteurNews = auteurNewsData as AuteurNews[];

/** Maps deprecated/duplicate film slugs to their canonical film id. */
export const FILM_ALIASES: Record<string, string> = {
  "nowhere-to-lay-my-eyes": "nowhere-to-lay-eyes",
};

export function truncateDescription(text: string, maxLen = 150): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).replace(/[，、；：,.;:\s]+$/, "")}…`;
}

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function withBase(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${assetBase}${path}`;
}

function getOrg(id: string): AwardOrg | undefined {
  return orgs.find((o) => o.id === id);
}

export function getFilm(id: string): Film | undefined {
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    decoded = id;
  }
  const film = films.find((f) => f.id === id || f.id === decoded);
  if (!film) return undefined;
  return { ...film, poster: withBase(film.poster) };
}

function filmKindOf(film: Film): FilmKind {
  if (film.genres.includes("荣誉")) return "honor";
  if (film.genres.includes("评审")) return "jury";
  return "film";
}

/** 纪录片（以 genres / 标题为准，不用剧情简介以免误伤） */
export function isDocumentaryFilm(film: Film): boolean {
  const genres = (film.genres || []).join("|");
  if (/(^|[|、,，/\s])纪录(片)?($|[|、,，/\s])|纪录片|documentary|docuseries/i.test(genres)) {
    return true;
  }
  const titles = `${film.title || ""} ${film.titleEn || ""}`;
  return /纪录片|\bdocumentary\b|\bdocuseries\b/i.test(titles);
}

/** 剧集 / 迷你剧 / 连续剧（本站时间线只收电影） */
export function isSeriesFilm(film: Film): boolean {
  const genres = (film.genres || []).join("|");
  const titles = `${film.title || ""} ${film.titleEn || ""}`;
  const blob = `${genres} ${titles}`;
  return /剧集|电视剧|连续剧|迷你剧|限定剧|网剧|\bTV\s*series\b|\bminiseries\b|\blimited\s*series\b/i.test(
    blob,
  );
}

/** 时间线只收院线/长片电影：排除纪录片与剧集 */
export function isTimelineEligibleFilm(film: Film): boolean {
  if (isDocumentaryFilm(film) || isSeriesFilm(film)) return false;
  return true;
}

const A_CLASS = new Set([
  "cannes",
  "venice",
  "berlin",
  "locarno",
  "san-sebastian",
  "shanghai",
  "tokyo",
  "busan",
  "karlovy-vary",
]);

export const AWARD_ONLY =
  /第\d+届|荣誉金狮|评委主席|日程公布|长片报名/;

export function splitFilmCopy(film: Film): {
  plot: string;
  background: string;
} {
  const background = (film.background || "").trim();
  const raw = (film.synopsis || "").trim();
  if (background) {
    return { plot: raw, background };
  }
  if (raw && AWARD_ONLY.test(raw)) {
    return { plot: "", background: raw };
  }
  return { plot: raw, background: "" };
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isPublished(date: string, today = todayISO()): boolean {
  if (!date) return true;
  return date <= today;
}

function awardLine(nom: CategoryNomination): string {
  const person =
    nom.personNames && nom.personNames.length > 0
      ? `· ${nom.personNames.join("、")}`
      : "";
  return `${nom.categoryName}${person}`;
}

type CeremonyBucket = {
  ceremony: AwardCeremony;
  org?: AwardOrg;
  film: Film;
  date: string;
  dateLabel: string;
  noms: CategoryNomination[];
};

export function getTimelineEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const today = todayISO();
  const buckets = new Map<string, CeremonyBucket>();

  for (const ceremony of ceremonies) {
    const org = getOrg(ceremony.orgId);

    for (const nom of ceremony.nominations) {
      const film = getFilm(nom.filmId);
      if (!film) continue;

      const sourceDate = nom.date || ceremony.date;
      const date = sourceDate || `${ceremony.year}-01-01`;
      if (!isPublished(date, today)) continue;

      const dateLabel = sourceDate ? formatDate(sourceDate) : `${ceremony.year}年`;
      const key = `${ceremony.orgId}|${ceremony.year}|${film.id}|${date}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.noms.push(nom);
        continue;
      }
      buckets.set(key, {
        ceremony,
        org,
        film,
        date,
        dateLabel,
        noms: [nom],
      });
    }
  }

  // 2026-11-05：时间线完全不进影展/奖项/入围（buckets 仍可计算，但不 push）。
  void buckets;

  for (const film of films) {
    if (!isTimelineEligibleFilm(film)) continue;
    for (const release of film.streaming) {
      // EDITORIAL.md: only officially dated streaming launches make the timeline
      // (tba / estimated windows stay on the film page only).
      if (release.status !== "announced" || !release.date) continue;
      if (!release.publishedAt || !isPublished(publicationTime(release).slice(0, 10), today)) continue;
      const platform = PLATFORM_LABELS[release.platform] || release.platform;
      const statusLabel = RELEASE_STATUS_LABELS[release.status];
      const datePart = formatDate(release.date);
      const region = release.region ? ` · ${release.region}` : "";
      const note = release.note ? `（${release.note}）` : "";
      const isLive = isPublished(release.date, today);
      const streamBadge = isLive ? "已上线" : "定档";

      const headline = buildStreamingHeadline({
        film,
        platform,
        statusLabel,
        // 有确切日期就直接写日期，不写「已公布」
        datePart,
        region: release.region,
      });
      const body = dedupeSubtitleAgainstTitle(
        headline,
        buildStreamingBody({
          film,
          platform,
          statusLabel,
          datePart,
          region: release.region,
          note: release.note,
        }),
      );

      const srcLabel = streamingSourceLabel(release);
      events.push({
        id: `stream-${film.id}-${release.platform}-${release.date || "tba"}`,
        type: "streaming",
        publishedAt: release.publishedAt,
        date: release.date || "",
        dateLabel: release.date ? formatDate(release.date) : "待定",
        filmId: film.id,
        filmTitle: film.title,
        filmTitleEn: film.titleEn,
        filmYear: film.year,
        poster: withBase(film.poster),
        posterColors: film.posterColors,
        headline,
        summary: body,
        detail: note || undefined,
        badge: streamBadge,
        directors: film.directors,
        filmKind: filmKindOf(film),
        sourceLabel: srcLabel,
        sourceUrl: release.source?.trim() || undefined,
      });
    }
  }

  for (const news of auteurNews) {
    if (!isPublished(news.date, today)) continue;
    const film = getFilm(news.filmId);
    if (!film) continue;
    if (!isTimelineEligibleFilm(film)) continue;
    const kind = filmKindOf(film);
    // 评审/荣誉/纯奖讯不进时间线
    if (kind === "jury" || kind === "honor") continue;
    const blob = `${news.summary || ""} ${news.detail || ""}`;
    // 文本明确写纪录片/剧集的也不进时间线
    if (/纪录片|档案纪录片|纪录短片|\bdocumentary\b|剧集|电视剧|连续剧|迷你剧|限定剧|\bTV\s*series\b|\bminiseries\b/i.test(blob)) {
      continue;
    }
    if (/获奖|入围|提名|金棕榈|金狮|金熊|奥斯卡|金球|金马|Trailblazer|奖项/i.test(blob)
      && !/出资源|熟肉|网盘|可下|定档|流媒体|上线|WEB-DL|BDRip/i.test(blob)) {
      continue;
    }
    let badge = "新片";
    if (/出资源|网盘可下|可下|WEB-DL|BDRip|压制/i.test(blob)) badge = "出资源";
    else if (/定档|将于.*上线|官宣.*上线/i.test(blob)) badge = "定档";
    else if (/上线|流出|熟肉|数字版|首发/i.test(blob)) badge = "已上线";
    else if (/critic|口碑|tomatometer|metacritic/i.test(blob)) continue; // 口碑不进时间线

    const headline = polishAuteurHeadline(news.summary, film);
    // 有独立 detail 时用 detail 作副文；否则用 summary，再与标题去重
    const rawSummary =
      news.detail && news.detail.trim() && news.detail.trim() !== (news.summary || "").trim()
        ? news.detail
        : news.summary || "";
    const summary = dedupeSubtitleAgainstTitle(headline, rawSummary);
    events.push({
      id: `auteur-${news.id}`,
      type: "auteur",
      publishedAt: news.publishedAt || `${news.date}T00:00:00+08:00`,
      date: news.date,
      dateLabel: formatDate(news.date),
      filmId: film.id,
      filmTitle: film.title,
      filmTitleEn: film.titleEn,
      filmYear: film.year,
      poster: withBase(film.poster),
      posterColors: film.posterColors,
      headline,
      summary,
      detail: news.detail && news.detail !== news.summary ? undefined : news.detail,
      badge,
      accentColor: badge === "出资源" ? "#34d399" : badge === "定档" ? "#38bdf8" : "#a78bfa",
      directors: film.directors,
      filmKind: kind,
      weiboUrl: news.weiboUrl,
      weiboLabel: news.weiboLabel,
    });
  }

  // 保留既有精选名单/配额；呈现顺序独立按首次发布时间倒序。
  return capPerDay(events).sort(comparePublicationTime);
}

/**
 * Editorial cap (see EDITORIAL.md): at most MAX_EVENTS_PER_DAY cards per
 * calendar day. Within a day, cards are ranked by eventPriority():
 *   出资源通知 > 流媒体已上线 > 流媒体定档.
 * Awards / nominations are never admitted to the timeline (2026-11-05).
 * Ties go to catalog auteurs, then coverage, then data order.
 */
export const MAX_EVENTS_PER_DAY = 3;

const CATALOG_AUTEURS = [
  "诺兰", "伊纳里图", "李沧东", "是枝裕和", "滨口龙介", "阿尔莫多瓦",
  "赫尔佐格", "麦克唐纳", "洪常秀", "萨金塞夫", "迈克·李", "拉雷恩",
  "拉腊因", "詹姆斯·格雷", "法哈蒂", "蒙吉", "莫莱蒂", "帕夫利科夫斯基",
];


function isResourceNotice(e: TimelineEvent): boolean {
  const blob = `${e.headline || ""} ${e.summary || ""} ${e.badge || ""}`;
  return /出资源|熟肉|网盘|可下|WEB-DL|BDRip|压制|数字版流出/i.test(blob);
}

function eventPriority(e: TimelineEvent): number {
  const auteurBonus = (e.directors || []).some((d) =>
    CATALOG_AUTEURS.some((name) => d.includes(name)),
  )
    ? 15
    : 0;
  switch (e.type) {
    case "streaming": {
      // 已上线 > 未来定档
      const announcedPast = e.badge === "已上线" || e.badge === "流媒体";
      return (announcedPast ? 230 : 200) + auteurBonus;
    }
    case "auteur": {
      if (isResourceNotice(e) || e.badge === "出资源") return 250 + auteurBonus;
      if (e.badge === "已上线" || /上线|流出|熟肉|数字版|首发/i.test(e.headline || ""))
        return 220 + auteurBonus;
      if (e.badge === "定档" || /定档|上线日|将于.*上线/i.test(e.headline || ""))
        return 200 + auteurBonus;
      // 其余作者向快讯极低，配额满时被挤掉
      return 80 + auteurBonus;
    }
    case "win":
    case "nomination":
      // 时间线不进奖项；若误入则垫底
      return 0;
  }
}

function capPerDay(events: TimelineEvent[]): TimelineEvent[] {
  const eligible = events.filter((e) => e.type !== "win" && e.type !== "nomination");
  const coverage = new Map<string, number>();
  for (const e of eligible) {
    if (e.filmId) coverage.set(e.filmId, (coverage.get(e.filmId) || 0) + 1);
  }
  const ranked = eligible.map((e, i) => ({
    e,
    i,
    p: eventPriority(e),
    c: e.filmId ? coverage.get(e.filmId) || 0 : 0,
  }));
  ranked.sort((a, b) => {
    const da = a.e.date || "0000-00-00";
    const db = b.e.date || "0000-00-00";
    if (da !== db) return db.localeCompare(da);
    return b.p - a.p || b.c - a.c || a.i - b.i;
  });
  const perDay = new Map<string, number>();
  const kept: TimelineEvent[] = [];
  for (const { e } of ranked) {
    const day = e.date || "tba";
    const n = perDay.get(day) || 0;
    if (n >= MAX_EVENTS_PER_DAY) continue;
    perDay.set(day, n + 1);
    kept.push(e);
  }
  return kept;
}

export function getFilmEvents(filmId: string): TimelineEvent[] {
  return getTimelineEvents().filter((e) => e.filmId === filmId);
}
