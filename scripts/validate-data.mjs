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
  for (const film of data.films ?? []) films.add(film.id);
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

console.log(
  `ok: ${news.length} news items, ${ceremonies.length} ceremonies, ${films.size} films in catalog`,
);
