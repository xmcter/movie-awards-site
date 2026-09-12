import filmsData from "@/data/films.json";
import orgsData from "@/data/orgs.json";
import ceremoniesData from "@/data/ceremonies.json";
import auteurNewsData from "@/data/auteur-news.json";
import majorAwardsData from "@/data/major-awards.json";
import type {
  AwardCeremony,
  AwardOrg,
  AuteurNews,
  Film,
  TimelineEvent,
} from "@/types";
import {
  PLATFORM_LABELS,
  RELEASE_STATUS_LABELS,
  formatDate,
  formatYearMonth,
} from "@/lib/labels";

const major = majorAwardsData as unknown as {
  orgs: AwardOrg[];
  films: Film[];
  ceremonies: AwardCeremony[];
};

export const films = [...(filmsData as Film[]), ...major.films];
export const orgs = [...(orgsData as AwardOrg[]), ...major.orgs];
export const ceremonies = [
  ...(ceremoniesData as AwardCeremony[]),
  ...major.ceremonies,
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

function getFilm(id: string): Film | undefined {
  return films.find((f) => f.id === id);
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
]);

/** YYYY-MM-DD in local calendar. Future dates stay in data but do not publish. */
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

export function getTimelineEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const today = todayISO();

  for (const ceremony of ceremonies) {
    const org = getOrg(ceremony.orgId);

    for (const nom of ceremony.nominations) {
      const film = getFilm(nom.filmId);
      if (!film) continue;

      const sourceDate = nom.date || ceremony.date;
      const date = sourceDate || `${ceremony.year}-01-01`;
      if (!isPublished(date, today)) continue;

      const dateLabel = sourceDate ? formatDate(sourceDate) : `${ceremony.year}年`;
      const isWin = nom.result === "won";
      const person =
        nom.personNames && nom.personNames.length > 0
          ? ` · ${nom.personNames.join("、")}`
          : "";
      const scope = org
        ? A_CLASS.has(org.id)
          ? `A类电影节 · ${org.name}`
          : `${org.name}`
        : undefined;

      events.push({
        id: `${ceremony.id}-${nom.categoryId}-${nom.filmId}-${nom.result}`,
        type: isWin ? "win" : "nomination",
        date,
        dateLabel,
        filmTitle: film.title,
        filmTitleEn: film.titleEn,
        filmYear: film.year,
        poster: withBase(film.poster),
        posterColors: film.posterColors,
        summary: `${ceremony.name} · ${nom.categoryName}${person}`,
        detail: scope
          ? `${scope}${ceremony.location ? ` · ${ceremony.location}` : ""}`
          : undefined,
        badge: isWin ? "获奖" : "入围",
        accentColor: org?.accentColor,
      });
    }
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
        filmTitle: film.title,
        filmTitleEn: film.titleEn,
        filmYear: film.year,
        poster: withBase(film.poster),
        posterColors: film.posterColors,
        summary: `${platform} · ${statusLabel} ${datePart}${region}`,
        detail: note || undefined,
        badge: "流媒体",
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
      filmTitle: film.title,
      filmTitleEn: film.titleEn,
      filmYear: film.year,
      poster: withBase(film.poster),
      posterColors: film.posterColors,
      summary: news.summary,
      detail: news.detail,
      badge: "作者",
      accentColor: "#a78bfa",
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
