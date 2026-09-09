import filmsData from "@/data/films.json";
import orgsData from "@/data/orgs.json";
import ceremoniesData from "@/data/ceremonies.json";
import type {
  AwardCeremony,
  AwardOrg,
  Film,
  TimelineEvent,
} from "@/types";
import {
  PLATFORM_LABELS,
  RELEASE_STATUS_LABELS,
  formatDate,
  formatYearMonth,
} from "@/lib/labels";

export const films = filmsData as Film[];
export const orgs = orgsData as AwardOrg[];
export const ceremonies = ceremoniesData as AwardCeremony[];

function getOrg(id: string): AwardOrg | undefined {
  return orgs.find((o) => o.id === id);
}

function getFilm(id: string): Film | undefined {
  return films.find((f) => f.id === id);
}

/** 从提名 / 获奖 / 流媒体种子数据派生时间线事件（最新在前） */
export function getTimelineEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const ceremony of ceremonies) {
    const org = getOrg(ceremony.orgId);
    const date = ceremony.date || `${ceremony.year}-01-01`;
    const dateLabel = ceremony.date
      ? formatDate(ceremony.date)
      : `${ceremony.year}年`;

    for (const nom of ceremony.nominations) {
      const film = getFilm(nom.filmId);
      if (!film) continue;

      const isWin = nom.result === "won";
      const person =
        nom.personNames && nom.personNames.length > 0
          ? ` · ${nom.personNames.join("、")}`
          : "";

      events.push({
        id: `${ceremony.id}-${nom.categoryId}-${nom.filmId}-${nom.result}`,
        type: isWin ? "win" : "nomination",
        date,
        dateLabel,
        filmTitle: film.title,
        filmTitleEn: film.titleEn,
        filmYear: film.year,
        summary: `${ceremony.name} · ${nom.categoryName}${isWin ? "获奖" : "提名"}${person}`,
        detail: org
          ? `${org.name}${ceremony.location ? ` · ${ceremony.location}` : ""}`
          : undefined,
        badge: isWin ? "获奖" : "提名",
        accentColor: org?.accentColor,
      });
    }
  }

  for (const film of films) {
    for (const release of film.streaming) {
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
        summary: `${platform} · ${statusLabel} ${datePart}${region}`,
        detail: note || undefined,
        badge: "流媒体",
      });
    }
  }

  return events.sort((a, b) => {
    const da = a.date || "0000-00-00";
    const db = b.date || "0000-00-00";
    if (da !== db) return db.localeCompare(da);
    // 同日：获奖 > 提名 > 流媒体
    const order = { win: 0, nomination: 1, streaming: 2 } as const;
    return order[a.type] - order[b.type];
  });
}
