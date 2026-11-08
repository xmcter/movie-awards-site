#!/usr/bin/env node
// Guards the timeline data: every auteur-news item must resolve to a film in the
// catalog, otherwise src/lib/data.ts silently drops the news from the timeline.
// Ceremony nominations pointing at films outside the catalog are reported as
// warnings (they are curated away on purpose), news misses are hard errors.
//
// Canonical film ownership (H-N1): a film id must appear in exactly one catalog
// file. Runtime src/lib/data.ts concatenates catalogs in this order and find()
// returns the first match, so the first file in this order is canonical:
// films.json > major-awards > extra-catalog > more-catalog > density-pack >
// wts > won > motn > movie-peek. Same id with conflicting title/year/streaming
// across files is an error; an exact duplicate is a warning.
//
// News publishedAt/source (M-N1): hand-written news items carry only `date` +
// `sourceLabel`; precise publishedAt/source cannot be recovered, so missing
// values are warnings, not errors. data.ts falls back to `${date}T00:00:00+08:00`
// and timelineOrder.comparePublicationTime has a stable id tiebreak.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const read = (name) => JSON.parse(readFileSync(join(DATA, name), "utf8"));
const readOpt = (name, fallback) => {
  try {
    return JSON.parse(readFileSync(join(DATA, name), "utf8"));
  } catch {
    return fallback;
  }
};

const CATALOG_FILES = [
  "films.json",
  "ceremonies.json",
  "major-awards.json",
  "more-catalog.json",
  "extra-catalog.json",
  "density-pack.json",
  "wts-streaming-catalog.json",
  "won-streaming-catalog.json",
  "motn-streaming-catalog.json",
  "movie-peek-catalog.json",
];

const films = new Set();
const filmsForStreaming = [];
// H-N1: track every (id -> [{file, title, year, streaming}]) for cross-file dup check.
const filmLocations = new Map();
const ceremonies = [];

for (const name of CATALOG_FILES) {
  const data = read(name);
  if (Array.isArray(data)) {
    for (const item of data) {
      // Ceremony objects (nominations array) are not films; skip film registration.
      if (item && Array.isArray(item.nominations)) { ceremonies.push(item); continue; }
      if (item && item.id) {
        films.add(item.id);
        filmsForStreaming.push({ ...item, _source: name });
        if (!filmLocations.has(item.id)) filmLocations.set(item.id, []);
        filmLocations.get(item.id).push({ file: name, title: item.title, year: item.year, streaming: item.streaming ?? [] });
      }
    }
    continue;
  }
  for (const film of data.films ?? []) {
    films.add(film.id);
    filmsForStreaming.push({ ...film, _source: name });
    if (!filmLocations.has(film.id)) filmLocations.set(film.id, []);
    filmLocations.get(film.id).push({ file: name, title: film.title, year: film.year, streaming: film.streaming ?? [] });
  }
  for (const ceremony of data.ceremonies ?? []) ceremonies.push(ceremony);
}
for (const ceremony of read("density-ceremonies.json")) ceremonies.push(ceremony);

// ---- H-N1: cross-file duplicate film ids ----
const dupErrors = [];
const dupWarnings = [];
for (const [id, locs] of filmLocations) {
  if (locs.length < 2) continue;
  const sig = (l) => JSON.stringify({ t: l.title, y: l.year, s: (l.streaming ?? []).map((s) => `${s.platform}|${s.date || ""}|${s.status}`) });
  const first = sig(locs[0]);
  if (locs.some((l) => sig(l) !== first)) {
    dupErrors.push(`${id} in ${locs.map((l) => l.file).join(", ")} (conflicting title/year/streaming)`);
  } else {
    dupWarnings.push(`${id} in ${locs.map((l) => l.file).join(", ")} (identical)`);
  }
}
for (const w of dupWarnings) console.warn(`warn: duplicate film id (identical): ${w}`);
if (dupErrors.length) {
  for (const e of dupErrors) console.error(`error: duplicate film id (conflict): ${e}`);
  console.error(`error: ${dupErrors.length} conflicting duplicate film id(s)`);
  process.exit(1);
}

// ---- L-N1: ceremony orgId must exist (orgs.json + major-awards.json embedded orgs, mirroring data.ts) ----
const orgIds = new Set(read("orgs.json").map((o) => o.id));
for (const o of read("major-awards.json").orgs ?? []) orgIds.add(o.id);
const badOrg = [...new Set(ceremonies.map((c) => c.orgId).filter((id) => id && !orgIds.has(id)))];
if (badOrg.length) {
  console.error(`error: ${badOrg.length} ceremony orgId(s) not in orgs.json nor major-awards.json embedded orgs: ${badOrg.join(", ")}`);
  process.exit(1);
}

const news = read("auteur-news.json");
const missingNews = [...new Set(news.map((n) => n.filmId).filter((id) => !films.has(id)))];

// ---- M-N7: ceremony nominations outside the catalog, minus the intentional-exclusion whitelist ----
const excluded = new Set((readOpt("excluded-films.json", [])).map((e) => (typeof e === "string" ? e : e.id)));
const ceremonyIds = ceremonies.flatMap((c) => c.nominations.map((n) => n.filmId));
const missingCeremony = [...new Set(ceremonyIds.filter((id) => id && !films.has(id)))];
const missingCeremonyToDo = missingCeremony.filter((id) => !excluded.has(id));
if (missingCeremonyToDo.length) {
  console.warn(
    `warn: ${missingCeremonyToDo.length} ceremony nomination(s) reference films outside the catalog ` +
      `(dropped from the timeline): ${missingCeremonyToDo.join(", ")}`,
  );
}

if (missingNews.length) {
  console.error(
    `error: ${missingNews.length} auteur-news item(s) reference missing films and would vanish ` +
      `from the timeline: ${missingNews.join(", ")}`,
  );
  process.exit(1);
}

// ---- M-N1: news missing publishedAt/source is a warning (hand-written items) ----
const newsNoMeta = news.filter((n) => !n.publishedAt || !n.source);
if (newsNoMeta.length) {
  console.warn(
    `warn: ${newsNoMeta.length} auteur-news item(s) lack publishedAt/source (hand-written, date fallback applies): ` +
      newsNoMeta.map((n) => n.id).join(", "),
  );
}

for (const item of news) {
  if (item.weiboUrl === undefined) continue;
  try {
    const url = new URL(item.weiboUrl);
    if (url.protocol !== "https:" ||
        !["m.weibo.cn", "weibo.com", "www.weibo.com"].includes(url.hostname) ||
        url.username || url.password || url.port) throw new Error("not a Weibo URL");
  } catch {
    console.error(`error: ${item.id}: weiboUrl must be a public HTTPS Weibo URL`);
    process.exit(1);
  }
}

// ---- M-N18: verified-film-awards.json ----
const verified = readOpt("verified-film-awards.json", []);
const verifiedErrors = [];
const verifiedWarnings = [];
for (const v of verified) {
  const where = `verified:${v.filmId}`;
  if (!v.filmId || !films.has(v.filmId)) verifiedErrors.push(`${where}: filmId not in catalog`);
  if (!v.source || typeof v.source !== "string" || !v.source.trim()) verifiedErrors.push(`${where}: source is required`);
  if (!v.verifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(v.verifiedAt)) verifiedErrors.push(`${where}: verifiedAt is required (YYYY-MM-DD)`);
  if (!v.icon) verifiedWarnings.push(`${where}: icon missing (${v.festival} ${v.category})`);
}
for (const w of verifiedWarnings) console.warn(`warn: ${w}`);
if (verifiedErrors.length) {
  for (const e of verifiedErrors) console.error(`error: ${e}`);
  console.error(`error: ${verifiedErrors.length} verified-film-awards error(s)`);
  process.exit(1);
}

// ---- M-N19: poster checks ----
const posterFiles = new Set();
try {
  for (const name of readdirSync(join(ROOT, "public", "posters"))) {
    const m = name.match(/^(.+)\.(jpe?g|png|webp)$/i);
    if (m) posterFiles.add(m[1]);
  }
} catch { /* no posters dir: every /posters/ ref will error below */ }
const placeholderAccepted = new Set(
  (readOpt("poster-placeholder-accepted.json", [])).map((e) => (typeof e === "string" ? e : e.id)),
);
const posterErrors = [];
const posterNoPoster = [];
const posterChecked = new Set();
for (const film of filmsForStreaming) {
  // check each film id once (canonical first wins if an id ever repeats)
  if (posterChecked.has(film.id)) continue;
  posterChecked.add(film.id);
  if (film.poster && /^https?:\/\//.test(film.poster)) {
    posterErrors.push(`${film.id}: poster is a remote URL, must be localized: ${film.poster}`);
  } else if (film.poster && film.poster.startsWith("/posters/")) {
    const base = film.poster.replace(/^\/posters\//, "").replace(/\.(jpe?g|png|webp)$/i, "");
    if (!posterFiles.has(base)) posterErrors.push(`${film.id}: poster file not on disk: ${film.poster}`);
  } else if (!film.poster) {
    if (!placeholderAccepted.has(film.id)) posterNoPoster.push(film.id);
  }
}
if (posterNoPoster.length) {
  console.warn(`warn: ${posterNoPoster.length} film(s) without poster (not in poster-placeholder-accepted.json): ${posterNoPoster.join(", ")}`);
}
if (posterErrors.length) {
  for (const e of posterErrors) console.error(`error: poster: ${e}`);
  console.error(`error: ${posterErrors.length} poster error(s)`);
  process.exit(1);
}

// ---- M-N20: streaming duplicates, orphan keys, empty fields ----
const streamingDupErrors = [];
{
  const seen = new Map();
  for (const film of filmsForStreaming) {
    for (const rel of film.streaming ?? []) {
      if (rel.status !== "announced" || !rel.date) continue;
      const k = `${film.id}|${rel.platform}`;
      if (seen.has(k) && seen.get(k) !== rel.date) {
        streamingDupErrors.push(`${film._source}:${film.id}: platform ${rel.platform} has multiple announced dates (${seen.get(k)} vs ${rel.date})`);
      } else if (!seen.has(k)) {
        seen.set(k, rel.date);
      }
    }
  }
}
if (streamingDupErrors.length) {
  for (const e of streamingDupErrors) console.error(`error: streaming duplicate: ${e}`);
  console.error(`error: ${streamingDupErrors.length} streaming duplicate error(s)`);
  process.exit(1);
}

// ---- M-N8: WTS catalog rows must carry a whentostream.com source ----
// The source field is the marker that distinguishes script-ingested rows
// (fetch_wts.mjs) from hand-written rows; no extra field is added for it.
// Every streaming entry in wts-streaming-catalog.json must link back to
// whentostream.com. (2026-11-09: gail-daughtry entry fixed — its source was
// a whats-on-netflix.com link although the synopsis said WTS; the real WTS
// post was found and linked instead.)
{
  const wtsErrors = [];
  for (const film of filmsForStreaming.filter((f) => f._source === "wts-streaming-catalog.json")) {
    for (const rel of film.streaming ?? []) {
      if (!rel.source || !rel.source.includes("whentostream.com")) {
        wtsErrors.push(`${film.id}: streaming ${rel.platform} ${rel.date || ""} lacks a whentostream.com source (got ${rel.source || "none"})`);
      }
    }
  }
  if (wtsErrors.length) {
    for (const e of wtsErrors) console.error(`error: wts source: ${e}`);
    console.error(`error: ${wtsErrors.length} wts source error(s)`);
    process.exit(1);
  }
}

const orphanWarnings = [];
for (const [file, keys] of [
  ["film-copy.json", Object.keys(readOpt("film-copy.json", {}))],
  ["tmdb-ids.json", Object.keys(readOpt("tmdb-ids.json", {}))],
]) {
  for (const k of keys) {
    if (!films.has(k)) orphanWarnings.push(`${file}: orphan key ${k} (no such film in catalog)`);
  }
}
const emptyFieldWarnings = [];
{
  const seenIds = new Set();
  for (const film of filmsForStreaming) {
    if (seenIds.has(film.id)) continue;
    seenIds.add(film.id);
    if (!film.genres || (Array.isArray(film.genres) && film.genres.length === 0)) emptyFieldWarnings.push(`${film.id}: genres empty`);
    if (!film.year) emptyFieldWarnings.push(`${film.id}: year empty`);
    if (!film.directors || (Array.isArray(film.directors) && film.directors.length === 0)) emptyFieldWarnings.push(`${film.id}: directors empty`);
  }
}
for (const w of [...orphanWarnings, ...emptyFieldWarnings]) console.warn(`warn: ${w}`);

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
    if (rel.status === "announced" && (!rel.publishedAt ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+08:00$/.test(rel.publishedAt) ||
        !isRealDate(rel.publishedAt.slice(0, 10)) || !Number.isFinite(Date.parse(rel.publishedAt)))) {
      streamingErrors.push(`${where}: announced streaming must carry first-ingested publishedAt (+08:00), not its launch date`);
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
