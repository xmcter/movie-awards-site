import filmsData from "@/data/films.json";
import orgsData from "@/data/orgs.json";
import ceremoniesData from "@/data/ceremonies.json";
import auteurNewsData from "@/data/auteur-news.json";
import majorAwardsData from "@/data/major-awards.json";
import moreCatalogData from "@/data/more-catalog.json";
import extraCatalogData from "@/data/extra-catalog.json";
import filmCopyData from "@/data/film-copy.json";
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
const filmCopy = filmCopyData as Record<string, FilmCopy>;

function applyCopy(film: Film): Film {
  const extraCopy = filmCopy[film.id];
  if (!extraCopy) return film;
  return {
    ...film,
    ...extraCopy,
    directors: extraCopy.directors ?? film.directors,
    cast: extraCopy.cast ?? film.cast,
  };
}

export const films = [
  ...(filmsData as Film[]),
  ...major.films,
  ...extra.films,
  ...moreExtra.films,
].map(applyCopy);
export const orgs = [...(orgsData as AwardOrg[]), ...(major.orgs ?? [])];
export const ceremonies = [
  ...(ceremoniesData as AwardCeremony[]),
  ...major.ceremonies,
  ...extra.ceremonies,
  ...moreExtra.ceremonies,
];
export const auteurNews = auteurNewsData as AuteurNews[];

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function withBase(path?: string): string | undefined {
  if (!path) return undefined;
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
    const awards = ordered.map(awardLine);
    const scope = org
      ? A_CLASS.has(org.id)
        ? `A类电影节 · ${org.name}`
        : `${org.name}`
      : undefined;

    let badge = isWin ? "获奖" : "入围";
    if (kind === "honor") badge = "荣誉";
    if (kind === "jury") badge = "评审";

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
      summary: `${ceremony.name} · ${awards.join(" / ")}`,
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
        summary: `${platform} · ${statusLabel} ${datePart}${region}`,
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
      summary: news.summary,
      detail: news.detail,
      badge: "作者",
      accentColor: "#a78bfa",
      directors: film.directors,
      filmKind: filmKindOf(film),
    });
  }

  return events.sort((a, b) => {
    const da = a.date || "0000-00-00";
    const db = b.date || "0000-00-00";
    if (da !== db) return db.localeCompare(da);
    const order = { win: 0, nomination: 1, auteur: 2, streaming: 3 } as const;
    return order[a.type] - order[b.type];
  });
}

export function getFilmEvents(filmId: string): TimelineEvent[] {
  return getTimelineEvents().filter((e) => e.filmId === filmId);
}
