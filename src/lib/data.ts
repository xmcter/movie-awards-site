import fs from "fs";
import path from "path";
import filmsData from "@/data/films.json";
import orgsData from "@/data/orgs.json";
import ceremoniesData from "@/data/ceremonies.json";
import auteurNewsData from "@/data/auteur-news.json";
import majorAwardsData from "@/data/major-awards.json";
import moreCatalogData from "@/data/more-catalog.json";
import extraCatalogData from "@/data/extra-catalog.json";
import densityPackData from "@/data/density-pack.json";
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
  formatYearMonth,
} from "@/lib/labels";
import {
  buildAwardBody,
  buildAwardHeadline,
  buildStreamingBody,
  buildStreamingHeadline,
  polishAuteurHeadline,
} from "@/lib/headlines";

type CatalogSlice = {
  orgs?: AwardOrg[];
  films: Film[];
  ceremonies: AwardCeremony[];
};

type FilmCopy = Partial<
  Pick<Film, "synopsis" | "background" | "directors" | "cast">
>;

const major = majorAwardsData as unknown as CatalogSlice;
const extra = moreCatalogData as unknown as CatalogSlice;
const moreExtra = extraCatalogData as unknown as CatalogSlice;
const density = densityPackData as unknown as CatalogSlice;
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
      map.set(m[1]!, `/posters/${name}`);
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
  const merged: Film = extraCopy
    ? {
        ...film,
        ...extraCopy,
        directors: extraCopy.directors ?? film.directors,
        cast: extraCopy.cast ?? film.cast,
        poster: local,
      }
    : { ...film, poster: local };
  return merged;
}

export const films = [
  ...(filmsData as Film[]),
  ...major.films,
  ...extra.films,
  ...moreExtra.films,
  ...density.films,
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
  const film = films.find((f) => f.id === id);
  if (!film) return undefined;
  return { ...film, poster: withBase(film.poster) };
}

function filmKindOf(film: Film): FilmKind {
  if (film.genres.includes("荣誉")) return "honor";
  if (film.genres.includes("评审")) return "jury";
  return "film";
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

  for (const bucket of buckets.values()) {
    const { ceremony, org, film, date, dateLabel, noms } = bucket;
    const kind = filmKindOf(film);
    const wins = noms.filter((n) => n.result === "won");
    const isWin = wins.length > 0;
    const ordered = [...wins, ...noms.filter((n) => n.result !== "won")];
    const awards = [...new Set(ordered.map(awardLine))];
    const scope = org
      ? A_CLASS.has(org.id)
        ? `A类电影节 · ${org.name}`
        : `${org.name}`
      : undefined;

    let badge = isWin ? "获奖" : "入围";
    if (kind === "honor") badge = "荣誉";
    if (kind === "jury") badge = "评审";

    const headline = buildAwardHeadline({ ceremony, org, film, noms, kind });
    const body = buildAwardBody({ ceremony, org, film, noms, awards });

    events.push({
      id: `${ceremony.orgId}-${ceremony.year}-${film.id}-${date}-${isWin ? "win" : "nom"}`,
      type: isWin ? "win" : "nomination",
      date,
      dateLabel,
      filmId: film.id,
      filmTitle: film.title,
      filmTitleEn: film.titleEn,
      filmYear: film.year,
      poster: withBase(film.poster),
      posterColors: film.posterColors,
      headline,
      summary: body,
      detail: scope
        ? `${scope}${ceremony.location ? ` · ${ceremony.location}` : ""}`
        : undefined,
      badge,
      accentColor: org?.accentColor,
      awards,
      directors: film.directors,
      filmKind: kind,
    });
  }

  for (const film of films) {
    for (const release of film.streaming) {
      if (release.date && !isPublished(release.date, today)) continue;
      const platform = PLATFORM_LABELS[release.platform] || release.platform;
      const statusLabel = RELEASE_STATUS_LABELS[release.status];
      const datePart = release.date
        ? release.status === "estimated"
          ? formatYearMonth(release.date)
          : formatDate(release.date)
        : "待定";
      const region = release.region ? ` · ${release.region}` : "";
      const note = release.note ? `（${release.note}）` : "";

      const headline = buildStreamingHeadline({
        film,
        platform,
        statusLabel,
        datePart,
        region: release.region,
      });
      const body = buildStreamingBody({
        film,
        platform,
        statusLabel,
        datePart,
        region: release.region,
        note: release.note,
      });

      events.push({
        id: `stream-${film.id}-${release.platform}-${release.date || "tba"}`,
        type: "streaming",
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
        badge: "流媒体",
        directors: film.directors,
        filmKind: filmKindOf(film),
      });
    }
  }

  for (const news of auteurNews) {
    if (!isPublished(news.date, today)) continue;
    const film = getFilm(news.filmId);
    if (!film) continue;
    const kind = filmKindOf(film);
    let badge = "新品";
    if (kind === "jury") badge = "评审";
    if (kind === "honor") badge = "荣誉";

    const headline = polishAuteurHeadline(news.summary, film);
    events.push({
      id: `auteur-${news.id}`,
      type: "auteur",
      date: news.date,
      dateLabel: formatDate(news.date),
      filmId: film.id,
      filmTitle: film.title,
      filmTitleEn: film.titleEn,
      filmYear: film.year,
      poster: withBase(film.poster),
      posterColors: film.posterColors,
      headline,
      summary: news.detail || news.summary,
      detail: news.detail && news.detail !== news.summary ? undefined : news.detail,
      badge,
      accentColor: kind === "jury" || kind === "honor" ? "#f59e0b" : "#a78bfa",
      directors: film.directors,
      filmKind: kind,
    });
  }

  return events.sort((a, b) => {
    const da = a.date || "0000-00-00";
    const db = b.date || "0000-00-00";
    if (da !== db) return db.localeCompare(da);
    const order = { auteur: 0, win: 1, nomination: 2, streaming: 3 } as const;
    return order[a.type] - order[b.type];
  });
}

export function getFilmEvents(filmId: string): TimelineEvent[] {
  return getTimelineEvents().filter((e) => e.filmId === filmId);
}
