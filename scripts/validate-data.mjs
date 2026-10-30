#!/usr/bin/env node
// Guards the timeline data: every auteur-news item must resolve to a film in the
// catalog, otherwise src/lib/data.ts silently drops the news from the timeline.
// Ceremony nominations pointing at films outside the catalog are reported as
// warnings (they are curated away on purpose), news misses are hard errors.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const read = (name) => JSON.parse(readFileSync(join(DATA, name), "utf8"));

const films = new Set(read("films.json").map((f) => f.id));
const filmsForStreaming = read("films.json").map((f) => ({ ...f, _source: "films.json" }));
const ceremonies = [];

for (const name of [
  "ceremonies.json",
  "major-awards.json",
  "more-catalog.json",
  "extra-catalog.json",
  "density-pack.json",
]) {
  const data = read(name);
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && Array.isArray(item.nominations)) ceremonies.push(item);
    }
    continue;
  }
  for (const film of data.films ?? []) {
    films.add(film.id);
    filmsForStreaming.push({ ...film, _source: name });
  }
  for (const ceremony of data.ceremonies ?? []) ceremonies.push(ceremony);
}
for (const ceremony of read("density-ceremonies.json")) ceremonies.push(ceremony);

const news = read("auteur-news.json");
const missingNews = [...new Set(news.map((n) => n.filmId).filter((id) => !films.has(id)))];

const ceremonyIds = ceremonies.flatMap((c) => c.nominations.map((n) => n.filmId));
const missingCeremony = [...new Set(ceremonyIds.filter((id) => id && !films.has(id)))];

if (missingCeremony.length) {
  console.warn(
    `warn: ${missingCeremony.length} ceremony nomination(s) reference films outside the catalog ` +
      `(dropped from the timeline): ${missingCeremony.join(", ")}`,
  );
}

if (missingNews.length) {
  console.error(
    `error: ${missingNews.length} auteur-news item(s) reference missing films and would vanish ` +
      `from the timeline: ${missingNews.join(", ")}`,
  );
  process.exit(1);
}

// Streaming validation (2026-10-29): platform must be in the StreamingPlatform
// enum in src/types/index.ts; date must be YYYY-MM-DD and a real date;
// announced must carry a date; tba/estimated must not carry a date (a date on
// them would be fabricated); region must be a string, not the legacy
// regions array; source, when present, must be non-empty. This scans all
// five catalog sources, not just films.json.
const PLATFORMS = new Set([
  "netflix", "disney-plus", "prime", "hulu", "max", "apple-tv",
  "iqiyi", "tencent", "youku", "bilibili", "mubi", "other",
]);
const STATUSES = new Set(["announced", "estimated", "tba"]);
const streamingErrors = [];
const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
for (const film of filmsForStreaming) {
  for (const rel of film.streaming ?? []) {
    const where = `${film._source}:${film.id}`;
    if (!PLATFORMS.has(rel.platform)) {
      streamingErrors.push(`${where}: platform out of enum: ${rel.platform}`);
    }
    if (!STATUSES.has(rel.status)) {
      streamingErrors.push(`${where}: status out of enum: ${rel.status}`);
    }
    if (rel.date !== undefined && !isRealDate(rel.date)) {
      streamingErrors.push(`${where}: date not YYYY-MM-DD or not a real date: ${rel.date}`);
    }
    if (rel.status === "announced" && !rel.date) {
      streamingErrors.push(`${where}: announced streaming must carry a date`);
    }
    if ((rel.status === "tba" || rel.status === "estimated") && rel.date) {
      streamingErrors.push(`${where}: ${rel.status} streaming must not carry a date (would be fabricated)`);
    }
    if (rel.regions !== undefined) {
      streamingErrors.push(`${where}: legacy regions array, use region string instead`);
    }
    if (rel.region !== undefined && typeof rel.region !== "string") {
      streamingErrors.push(`${where}: region must be a string`);
    }
    if (rel.source !== undefined && (typeof rel.source !== "string" || !rel.source.trim())) {
      streamingErrors.push(`${where}: source must be a non-empty string`);
    }
  }
}
if (streamingErrors.length) {
  for (const e of streamingErrors) console.error(`error: streaming: ${e}`);
  console.error(`error: ${streamingErrors.length} streaming validation error(s)`);
  process.exit(1);
}

console.log(
  `ok: ${news.length} news items, ${ceremonies.length} ceremonies, ${films.size} films in catalog`,
);
