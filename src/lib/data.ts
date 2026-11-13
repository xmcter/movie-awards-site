import verifiedFilmAwards from "@/data/verified-film-awards.json";
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

import auteurDirectorsData from "@/data/auteur-directors.json";
import priorAwardDirectorsData from "@/data/prior-award-directors.json";
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
  formatContentDates,
  formatSourcePublishedLabel,
  normalizeSourceLabel,
  streamingSourceLabel,
} from "@/lib/labels";
import {
  badgeEn,
  formatContentDatesEn,
  formatDateEn,
  formatSourcePublishedLabelEn,
  filmTitleEn,
  directorNamesEn,
  sourceLabelEn,
  splitFilmCopyEn,
  isIndexableFilmEn,
  PLATFORM_LABELS_EN,
  RELEASE_STATUS_LABELS_EN,
  type Locale,
} from "@/lib/i18n";
import {
  buildStreamingHeadlineEn,
  buildStreamingBodyEn,
  polishAuteurHeadlineEn,
  dedupeSubtitleAgainstTitleEn,
} from "@/lib/headlines-en";
import {
  buildAwardBody,
  buildAwardHeadline,
  buildStreamingBody,
  buildStreamingHeadline,
  dedupeSubtitleAgainstTitle,
  polishAuteurHeadline,
  scrubNegativeCopy,
  stripStreamingBoilerplate,
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
    | "synopsisEn"
    | "background"
    | "backgroundEn"
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

/** films.json 的 id。质量分里的核心片库命中只用这一份，避免每次打分都重建 Set。 */
const CORE_FILM_IDS = new Set((filmsData as Film[]).map((f) => f.id));

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
  return film.poster;
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
  /** MotN 侧的 la-bola-negra 与 films.json 的 the-black-ball 是同一部《黑球》。 */
  "la-bola-negra": "the-black-ball",
  /** Peek 的 movie-douban-36808876 与 films.json 的 the-odyssey 是同一部《奥德赛》。 */
  "movie-douban-36808876": "the-odyssey",
  /** WTS 的 other-mommy 与 Peek 的 movie-douban-37317907 是同一部《另一个妈妈 / Other Mommy》。 */
  "other-mommy": "movie-douban-37317907",
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

/** MotN/WTS 入库时常写的「《片名》流媒体定档（美国区…）」——不是剧情，不当简介展示。 */
function isStreamingMetaSynopsis(text: string, title?: string, titleEn?: string): boolean {
  const s = (text || "").trim();
  if (!s) return false;
  if (s.length > 120) return false;
  const t = (title || "").trim();
  const te = (titleEn || "").trim();
  const mentionsTitle = t || te
    ? (t && (s.includes(t) || s.includes(`《${t}》`))) || (te && s.includes(te))
    : /《.+》/.test(s);
  const meta =
    /流媒体定档|片夜数据|以平台官方为准|美国区定档|区定档/.test(s) &&
    !/执导|主演|讲述|故事|改编|获奖|入围|拍摄|取材/.test(s);
  return Boolean(mentionsTitle && meta);
}

export function splitFilmCopy(film: Film, locale: Locale = "zh"): {
  plot: string;
  background: string;
} {
  if (locale === "en") return splitFilmCopyEn(film);
  const background = (film.background || "").trim();
  let raw = (film.synopsis || "").trim();
  // 中文简介待翻译（copyPending）时 synopsis 还是英文原文，不当中文剧情展示。
  if (film.copyPending?.includes("synopsis")) raw = "";
  if (isStreamingMetaSynopsis(raw, film.title, film.titleEn)) raw = "";
  if (background) {
    return { plot: raw, background };
  }
  if (raw && AWARD_ONLY.test(raw)) {
    return { plot: "", background: raw };
  }
  return { plot: raw, background: "" };
}

export function todayISO(now = new Date()): string {
  // 定时构建跑在 UTC 的 GitHub Actions 上；站内“今天”一律按上海日历，
  // 否则每天 00:30 CST 的构建会把当天冻成上海的昨天。
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
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

type AuteurDirectorEntry = {
  names: string[];
  /** 给人看的奖项或来源说明，不参与匹配。 */
  note?: string;
};

/** 作者向导演（中英名）；命中则优先进时间线。名单在 src/data/auteur-directors.json。 */
const AUTEUR_DIRECTORS: string[] = (auteurDirectorsData as AuteurDirectorEntry[])
  .flatMap((entry) => entry.names)
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

/** 以前得过奖（含提名）的导演；命中则优先进时间线。名单在 src/data/prior-award-directors.json。用户 2026-11-08 定：以前获奖导演拍的片尽量不拦，提名也放行。 */
const PRIOR_AWARD_DIRECTORS: string[] = (priorAwardDirectorsData as AuteurDirectorEntry[])
  .flatMap((entry) => entry.names)
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

const AWARDED_FILM_IDS = (() => {
  const ids = new Set<string>();
  for (const c of ceremonies) {
    for (const n of c.nominations || []) {
      if (n.filmId) ids.add(n.filmId);
    }
  }
  return ids;
})();

/** 口水/凑数定档：节日片、无导演商业流水线等，默认不进主列表。 */
const FILLER_TITLE_RE =
  /圣诞|圣诞节|Christmas|Holiday|Tyler Perry|泰勒·?佩里|Paw Patrol|汪汪队|Warrior Kid|战士小子|Bag Man|提袋人|节日迷雾|威斯康星圣诞|快乐窃贼|完美骗子|壁炉|Batman.*Knight|蝙蝠侠：骑士|Super Troopers|Rolling Loud|Angel and the Badman|天使与坏蛋/i;

/** 经典系列 IP：续集本身即有受众，直接收，不看平台分。用户 2026-11-08 定：潜伏系列不拦。 */
const CLASSIC_FRANCHISE_RE = /Insidious|潜伏/i;

function isClassicFranchiseFilm(film: Film): boolean {
  const titleBlob = `${film.title || ""} ${film.titleEn || ""}`;
  return CLASSIC_FRANCHISE_RE.test(titleBlob);
}

function directorsBlob(film: Film): string {
  return (film.directors || []).join(" ");
}

function isAuteurFilm(film: Film): boolean {
  const blob = directorsBlob(film);
  if (!blob.trim()) return false;
  return AUTEUR_DIRECTORS.some((name) => blob.includes(name));
}

function isPriorAwardDirectorFilm(film: Film): boolean {
  const blob = directorsBlob(film);
  if (!blob.trim()) return false;
  return PRIOR_AWARD_DIRECTORS.some((name) => blob.includes(name));
}

function isAwardedFilm(film: Film): boolean {
  return AWARDED_FILM_IDS.has(film.id) || AWARDED_FILM_IDS.has(FILM_ALIASES[film.id] || "");
}

/**
 * 流媒体定档只收新片：上映/首映年 >= 当前公历年 - 2（近两年新片；经典回档剔除）。
 * 经典回档、片库老片上新一律不进主列表（影片档仍可保留 streaming）。
 */
export function streamingNewFilmMinYear(now = new Date()): number {
  return now.getFullYear() - 2;
}

export function isNewStreamingFilm(film: Film, now = new Date()): boolean {
  const y = film.year;
  if (typeof y !== "number" || !Number.isFinite(y)) return false;
  return y >= streamingNewFilmMinYear(now);
}

/** 质量分：越高越优先；负分硬过滤出时间线。先过新片年窗，再打分。 */
export function streamingQualityScore(film: Film, platform?: string): number {
  let score = 0;
  if (isAuteurFilm(film)) score += 100;
  if (isPriorAwardDirectorFilm(film)) score += 100;
  if (isAwardedFilm(film)) score += 80;
  if (platform === "mubi") score += 45;
  if (platform === "apple-tv" && isAuteurFilm(film)) score += 10;
  // 核心片库（非纯 MotN/WON 流水线）
  if (CORE_FILM_IDS.has(film.id) || film.id in filmCopy) score += 20;
  const titleBlob = `${film.title || ""} ${film.titleEn || ""}`;
  if (FILLER_TITLE_RE.test(titleBlob)) score -= 80;
  if (!(film.directors && film.directors.length)) score -= 35;
  // Netflix 纯上新日历且无作者/奖项线索
  if (platform === "netflix" && !isAuteurFilm(film) && !isAwardedFilm(film) && score < 40) {
    score -= 15;
  }
  return score;
}

export function shouldAdmitStreaming(film: Film, platform: string, now = new Date()): boolean {
  // 老片回档 / 经典上新：硬拒（即使作者或 MUBI）
  if (!isNewStreamingFilm(film, now)) return false;
  // 作者 / 获奖 / 以前获奖（含提名）导演 / MUBI / 经典系列 IP 通道直接收
  if (isAuteurFilm(film) || isAwardedFilm(film) || isPriorAwardDirectorFilm(film) || platform === "mubi" || isClassicFranchiseFilm(film)) return true;
  return streamingQualityScore(film, platform) >= 25;
}

export function getTimelineEvents(locale: Locale = "zh"): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const today = todayISO();
  const buckets = new Map<string, CeremonyBucket>();
  const en = locale === "en";

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
      // 质量闸：口水定档不进主列表（影片档仍保留 streaming 字段）
      if (!shouldAdmitStreaming(film, release.platform)) continue;
      // 重复片（见 FILM_ALIASES）：定档数据仍用原记录，展示归到规范片名下，
      // 时间线按片去重时合并为一张卡，影片页由别名跳转兜底。
      const canonicalFilm =
        FILM_ALIASES[film.id] ? films.find((f) => f.id === FILM_ALIASES[film.id]) || film : film;
      const platform = en
        ? PLATFORM_LABELS_EN[release.platform] || release.platform
        : PLATFORM_LABELS[release.platform] || release.platform;
      const statusLabel = en
        ? RELEASE_STATUS_LABELS_EN[release.status]
        : RELEASE_STATUS_LABELS[release.status];
      const datePart = en ? formatDateEn(release.date) : formatDate(release.date);
      // 日历经过不等于已核实资源：计划始终显示日期+上线，只有 peek 实证才标已上线。
      const streamBadge = en ? "Streaming planned" : "上线计划";

      const headline = en
        ? buildStreamingHeadlineEn({ film: canonicalFilm, statusLabel, datePart, date: release.date })
        : buildStreamingHeadline({
            film: canonicalFilm,
            platform,
            statusLabel,
            datePart,
            date: release.date,
            region: release.region,
          });
      const body = en
        ? buildStreamingBodyEn()
        : dedupeSubtitleAgainstTitle(
            headline,
            buildStreamingBody({
              film: canonicalFilm,
              platform,
              statusLabel,
              datePart,
              region: release.region,
              note: release.note,
            }),
          );
      // detail 与 summary 同源增量；口水 note 不再塞进 detail 造成详情页叠字
      // 英文不翻译 note（中文营销套话），detail 留空。
      const noteExtra = en
        ? ""
        : stripStreamingBoilerplate(release.note || "", {
            platform,
            region: release.region,
            datePart,
            filmTitle: canonicalFilm.title,
          });
      const note = noteExtra ? `（${noteExtra}）` : "";

      const srcLabel = en ? sourceLabelEn(streamingSourceLabel(release)) : streamingSourceLabel(release);
      const sourcePublishedAt = release.sourcePublishedAt || undefined;
      const pubIso = sourcePublishedAt || release.publishedAt;
      events.push({
        id: `stream-${film.id}-${release.platform}-${release.date || "tba"}`,
        type: "streaming",
        publishedAt: pubIso,
        date: release.date || "",
        dateLabel: release.date ? (en ? formatDateEn(release.date) : formatDate(release.date)) : en ? "TBA" : "待定",
        filmId: canonicalFilm.id,
        filmTitle: en ? filmTitleEn(canonicalFilm) : canonicalFilm.title,
        filmTitleEn: canonicalFilm.titleEn,
        filmYear: canonicalFilm.year,
        poster: withBase(canonicalFilm.poster),
        posterColors: canonicalFilm.posterColors,
        headline,
        summary: body,
        plot: (en ? splitFilmCopy(canonicalFilm, "en").plot : scrubNegativeCopy(splitFilmCopy(canonicalFilm).plot)) || undefined,
        filmAwards: verifiedFilmAwards.filter(a => a.filmId === canonicalFilm.id && (a.result === "won" || a.result === "nominated")),
        detail: note || undefined,
        badge: streamBadge,
        directors: en ? directorNamesEn(canonicalFilm.directors) : canonicalFilm.directors,
        filmKind: filmKindOf(canonicalFilm),
        sourceLabel: srcLabel,
        sourceUrl: release.source?.trim() || undefined,
        sourcePublishedAt: sourcePublishedAt || release.publishedAt,
        sourcePublishedLabel: en
          ? formatSourcePublishedLabelEn(sourcePublishedAt || release.publishedAt, { isOriginal: Boolean(sourcePublishedAt) })
          : formatSourcePublishedLabel(
              sourcePublishedAt || release.publishedAt,
              { isOriginal: Boolean(sourcePublishedAt) },
            ),
      });
    }
  }

  for (const news of auteurNews) {
    if (!isPublished(news.date, today)) continue;
    // 重复片（见 FILM_ALIASES）：资讯归到规范片名下，与流媒体事件合并为一张卡。
    const film =
      getFilm(FILM_ALIASES[news.filmId] || news.filmId) || getFilm(news.filmId);
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
    if (/出资源|已出源|已上线|网盘可下|可下|WEB-DL|BDRip|压制/i.test(blob)) badge = "已上线";
    else if (/定档|将于.*上线|官宣.*上线/i.test(blob)) badge = "定档";
    else if (/上线|流出|熟肉|数字版|首发/i.test(blob)) badge = "已上线";
    else if (/critic|口碑|tomatometer|metacritic/i.test(blob)) continue; // 口碑不进时间线

    const verifiedResource = news.id.startsWith("movie-peek-");
    const headline = en
      ? verifiedResource
        ? `${filmTitleEn(film)} is out now`
        : polishAuteurHeadlineEn(news.summaryEn || "", film)
      : verifiedResource
        ? `《${film.title}》已上线`
        : polishAuteurHeadline(news.summary, film);
    // 有独立 detail 时用 detail 作副文；否则用 summary，再与标题去重
    const rawSummary = en
      ? verifiedResource
        ? news.detailEn || ""
        : news.detailEn && news.detailEn.trim() && news.detailEn.trim() !== (news.summaryEn || "").trim()
          ? news.detailEn
          : news.summaryEn || ""
      : verifiedResource ? (news.detail || "") :
        news.detail && news.detail.trim() && news.detail.trim() !== (news.summary || "").trim()
          ? news.detail
          : news.summary || "";
    const summary = en
      ? dedupeSubtitleAgainstTitleEn(headline, rawSummary)
      : scrubNegativeCopy(
          dedupeSubtitleAgainstTitle(headline, scrubNegativeCopy(rawSummary)),
        );
    const srcLabel = en
      ? sourceLabelEn(
          normalizeSourceLabel(news.sourceLabel) ||
            streamingSourceLabel({ source: news.source, sourceLabel: news.sourceLabel }) ||
            (news.weiboUrl ? "Weibo" : undefined),
        )
      : normalizeSourceLabel(news.sourceLabel) ||
        streamingSourceLabel({ source: news.source, sourceLabel: news.sourceLabel }) ||
        (news.weiboUrl ? "微博" : undefined);
    const sourcePublishedAt = news.sourcePublishedAt || undefined;
    const pubIso = sourcePublishedAt || news.publishedAt || `${news.date}T00:00:00+08:00`;
    events.push({
      id: `auteur-${news.id}`,
      type: "auteur",
      publishedAt: pubIso,
      date: news.date,
      dateLabel: en ? formatDateEn(news.date) : formatDate(news.date),
      filmId: film.id,
      filmTitle: en ? filmTitleEn(film) : film.title,
      filmTitleEn: film.titleEn,
      filmYear: film.year,
      poster: withBase(film.poster),
      posterColors: film.posterColors,
      headline,
      summary,
      plot: (en ? splitFilmCopy(film, "en").plot : scrubNegativeCopy(splitFilmCopy(film).plot)) || undefined,
        filmAwards: verifiedFilmAwards.filter(a => a.filmId === film.id && (a.result === "won" || a.result === "nominated")),
      // detail 已并入 summary 时不再挂一份，避免详情页标题/摘要/正文三重重复
      detail: undefined,
      badge: en ? (verifiedResource ? "Out now" : badgeEn(badge) || badge) : verifiedResource ? "已上线" : badge,
      accentColor: badge === "已上线" ? "#34d399" : badge === "定档" ? "#38bdf8" : "#a78bfa",
      directors: en ? directorNamesEn(film.directors) : film.directors,
      filmKind: kind,
      sourceLabel: srcLabel,
      sourceUrl: (news.source || news.weiboUrl || "").trim() || undefined,
      sourcePublishedAt: sourcePublishedAt || news.publishedAt,
      sourcePublishedLabel: en
        ? formatSourcePublishedLabelEn(
            sourcePublishedAt || news.publishedAt || `${news.date}T00:00:00+08:00`,
            { isOriginal: Boolean(sourcePublishedAt) },
          )
        : formatSourcePublishedLabel(
            sourcePublishedAt || news.publishedAt || `${news.date}T00:00:00+08:00`,
            { isOriginal: Boolean(sourcePublishedAt) },
          ),
      weiboUrl: news.weiboUrl,
      weiboLabel: news.weiboLabel,
    });
  }

  // 质量闸已在入库时过滤口水定档；不再按发布日卡条数，按首次发布时间倒序。
  return events
    .filter((e) => e.type !== "win" && e.type !== "nomination")
    .sort(comparePublicationTime)
    .map(e => en
      ? { ...e, headline: formatContentDatesEn(e.headline || ""), summary: formatContentDatesEn(e.summary || ""), detail: e.detail ? formatContentDatesEn(e.detail) : undefined }
      : { ...e, headline: formatContentDates(e.headline || ""), summary: formatContentDates(e.summary || ""), detail: e.detail ? formatContentDates(e.detail) : undefined });
}

/** 影片页「相关动态」的去重键：标题规范化（小写、去标点空白）。 */
function eventTitleKey(event: TimelineEvent): string {
  return (event.headline || event.filmTitle || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function getFilmEvents(filmId: string, locale: Locale = "zh"): TimelineEvent[] {
  const seen = new Set<string>();
  return getTimelineEvents(locale)
    .filter(
      (e) =>
        e.filmId === filmId ||
        (e.filmId !== undefined && FILM_ALIASES[e.filmId] === filmId),
    )
    // 别名合并后同一可见标题只留一条（最新的一条在前）：例如《奥德赛》的两条
    // Peek「已上线」事件，标题相同就不再重复列出。
    .filter((e) => {
      const key = eventTitleKey(e);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** 即将上线：已过质量闸、日期在今天及之后的流媒体定档，按日期升序。 */
export interface ComingSoonRelease {
  filmId: string;
  filmTitle: string;
  filmTitleEn?: string;
  filmYear?: number;
  poster?: string;
  posterColors?: [string, string];
  directors?: string[];
  platform: string;
  date: string;
}

export function getComingSoonReleases(now = new Date(), locale: Locale = "zh"): ComingSoonRelease[] {
  const today = todayISO(now);
  const out: ComingSoonRelease[] = [];
  const en = locale === "en";
  for (const film of films) {
    if (!isTimelineEligibleFilm(film)) continue;
    // 重复片（见 FILM_ALIASES）：展示归到规范片名下。
    const canonicalFilm =
      FILM_ALIASES[film.id] ? films.find((f) => f.id === FILM_ALIASES[film.id]) || film : film;
    for (const release of film.streaming) {
      if (release.status !== "announced" || !release.date) continue;
      if (!release.publishedAt || !isPublished(publicationTime(release).slice(0, 10), today)) continue;
      if (!shouldAdmitStreaming(film, release.platform, now)) continue;
      if (release.date < today) continue;
      out.push({
        filmId: canonicalFilm.id,
        filmTitle: en ? filmTitleEn(canonicalFilm) : canonicalFilm.title,
        filmTitleEn: canonicalFilm.titleEn,
        filmYear: canonicalFilm.year,
        poster: withBase(canonicalFilm.poster),
        posterColors: canonicalFilm.posterColors,
        directors: en ? directorNamesEn(canonicalFilm.directors) : canonicalFilm.directors,
        platform: release.platform,
        date: release.date,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.filmTitle.localeCompare(b.filmTitle, "zh-CN"));
}

/** 详情页复用与首页卡同一口径的已核实奖项：仅 won/nominated 且有证据链接。 */
export function getVerifiedFilmAwards(filmId: string) {
  return verifiedFilmAwards.filter(
    (a) => a.filmId === filmId && (a.result === "won" || a.result === "nominated") && Boolean(a.source?.trim()),
  );
}

/** 只将具有实质中文剧情/背景的影片档纳入索引；薄目录页仍可导航访问。 */
export function isIndexableFilm(film: Film, locale: Locale = "zh"): boolean {
  if (locale === "en") return isIndexableFilmEn(film);
  const { plot, background } = splitFilmCopy(film);
  const content = `${plot} ${background}`;
  return (content.match(/[\u4e00-\u9fff]/g) || []).length >= 40;
}
