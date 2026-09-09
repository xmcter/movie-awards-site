import filmsData from "@/data/films.json";
import orgsData from "@/data/orgs.json";
import ceremoniesData from "@/data/ceremonies.json";
import peopleData from "@/data/people.json";
import type {
  AwardCeremony,
  AwardOrg,
  AwardOrgId,
  Film,
  Person,
  SearchResult,
  StreamingRelease,
} from "@/types";

export const films = filmsData as Film[];
export const orgs = orgsData as AwardOrg[];
export const ceremonies = ceremoniesData as AwardCeremony[];
export const people = peopleData as Person[];

export function getFilm(id: string): Film | undefined {
  return films.find((f) => f.id === id);
}

export function getOrg(id: AwardOrgId | string): AwardOrg | undefined {
  return orgs.find((o) => o.id === id);
}

export function getCeremony(id: string): AwardCeremony | undefined {
  return ceremonies.find((c) => c.id === id);
}

export function getCeremoniesByOrg(orgId: string): AwardCeremony[] {
  return ceremonies
    .filter((c) => c.orgId === orgId)
    .sort((a, b) => b.year - a.year);
}

export function getFilmAwards(filmId: string) {
  const records: {
    ceremony: AwardCeremony;
    org: AwardOrg;
    categoryName: string;
    result: "nominated" | "won";
    personNames?: string[];
  }[] = [];

  for (const ceremony of ceremonies) {
    const org = getOrg(ceremony.orgId);
    if (!org) continue;
    for (const nom of ceremony.nominations) {
      if (nom.filmId === filmId) {
        records.push({
          ceremony,
          org,
          categoryName: nom.categoryName,
          result: nom.result,
          personNames: nom.personNames,
        });
      }
    }
  }
  return records;
}

export function getRecentWinners(limit = 8) {
  const winners: {
    film: Film;
    ceremony: AwardCeremony;
    org: AwardOrg;
    categoryName: string;
  }[] = [];

  const sorted = [...ceremonies].sort((a, b) => {
    const da = a.date || `${a.year}-01-01`;
    const db = b.date || `${b.year}-01-01`;
    return db.localeCompare(da);
  });

  for (const ceremony of sorted) {
    const org = getOrg(ceremony.orgId);
    if (!org) continue;
    for (const nom of ceremony.nominations) {
      if (nom.result !== "won") continue;
      const film = getFilm(nom.filmId);
      if (!film) continue;
      winners.push({ film, ceremony, org, categoryName: nom.categoryName });
      if (winners.length >= limit) return winners;
    }
  }
  return winners;
}

export function getUpcomingCeremonies(limit = 4) {
  const today = "2025-01-01";
  return [...ceremonies]
    .filter((c) => !c.date || c.date >= today || c.year >= 2025)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .slice(0, limit)
    .map((c) => ({ ceremony: c, org: getOrg(c.orgId)! }))
    .filter((x) => x.org);
}

export interface StreamingEntry {
  film: Film;
  release: StreamingRelease;
}

export function getAllStreamingReleases(): StreamingEntry[] {
  const entries: StreamingEntry[] = [];
  for (const film of films) {
    for (const release of film.streaming) {
      entries.push({ film, release });
    }
  }
  return entries.sort((a, b) => {
    const da = a.release.date || "9999-99-99";
    const db = b.release.date || "9999-99-99";
    return da.localeCompare(db);
  });
}

export function getSoonOnStreaming(limit = 6): StreamingEntry[] {
  const today = "2024-12-01";
  return getAllStreamingReleases()
    .filter((e) => !e.release.date || e.release.date >= today)
    .slice(0, limit);
}

export function searchAll(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const film of films) {
    const hay = [
      film.title,
      film.titleEn,
      ...film.directors,
      ...film.cast,
      ...film.genres,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) {
      results.push({
        type: "film",
        id: film.id,
        title: film.title,
        subtitle: `${film.year}${film.titleEn ? ` · ${film.titleEn}` : ""}`,
        href: `/films/${film.id}`,
      });
    }
  }

  for (const person of people) {
    const hay = [person.name, person.nameEn, person.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) {
      results.push({
        type: "person",
        id: person.id,
        title: person.name,
        subtitle: person.nameEn || person.role,
        href: `/search?q=${encodeURIComponent(person.name)}`,
      });
    }
  }

  for (const org of orgs) {
    const hay = [org.name, org.nameEn, org.description]
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) {
      results.push({
        type: "award",
        id: org.id,
        title: org.name,
        subtitle: org.nameEn,
        href: `/awards/${org.id}`,
      });
    }
  }

  for (const ceremony of ceremonies) {
    const hay = [ceremony.name, ceremony.nameEn, String(ceremony.year)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) {
      results.push({
        type: "award",
        id: ceremony.id,
        title: ceremony.name,
        subtitle: ceremony.nameEn,
        href: `/awards/${ceremony.orgId}/${ceremony.id}`,
      });
    }
  }

  return results.slice(0, 40);
}

export function groupNominationsByCategory(ceremony: AwardCeremony) {
  const map = new Map<
    string,
    { categoryId: string; categoryName: string; items: typeof ceremony.nominations }
  >();
  for (const nom of ceremony.nominations) {
    const key = nom.categoryId;
    if (!map.has(key)) {
      map.set(key, {
        categoryId: nom.categoryId,
        categoryName: nom.categoryName,
        items: [],
      });
    }
    map.get(key)!.items.push(nom);
  }
  return Array.from(map.values());
}
