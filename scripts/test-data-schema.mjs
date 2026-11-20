#!/usr/bin/env node
/**
 * Offline catalog schema checks. Does not fetch, write data, or change the site.
 *
 * Hard failures: missing required fields, duplicate slugs, invalid dates,
 * poster paths that do not exist on disk, remote poster URLs.
 *
 * Known issues stay green: non-ascii slug `ketticè` is a todo; empty synopsis /
 * directors / genres and films allowed to render without a poster are warnings.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..");
const DATA = join(ROOT, "src", "data");

const CATALOG_FILES = [
  "films.json",
  "major-awards.json",
  "extra-catalog.json",
  "more-catalog.json",
  "density-pack.json",
  "wts-streaming-catalog.json",
  "won-streaming-catalog.json",
  "motn-streaming-catalog.json",
  "movie-peek-catalog.json",
];

const FILM_REQUIRED = ["id", "title", "year", "synopsis", "directors", "cast", "genres", "streaming"];
const NEWS_REQUIRED = ["id", "filmId", "date", "kind", "summary"];
const CEREMONY_REQUIRED = ["id", "orgId", "name", "year", "nominations"];
const ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PUBLISHED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ANNOUNCED_PUBLISHED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+08:00$/;

/** Slugs that already ship and are not lowercase ascii. New ones still fail. */
const KNOWN_NON_ASCII_SLUGS = new Set(["ketticè"]);

const read = (name) => JSON.parse(readFileSync(join(DATA, name), "utf8"));
const readOpt = (name, fallback) => {
  try {
    return JSON.parse(readFileSync(join(DATA, name), "utf8"));
  } catch {
    return fallback;
  }
};

function filmsOf(data) {
  if (Array.isArray(data)) return data.filter((item) => item && item.id && !Array.isArray(item.nominations));
  return data.films ?? [];
}

function isRealDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const catalogFilms = CATALOG_FILES.flatMap((file) =>
  filmsOf(read(file)).map((film) => ({ ...film, _source: file })),
);

const ceremonies = [];
for (const file of ["ceremonies.json", "density-ceremonies.json"]) {
  for (const ceremony of read(file)) ceremonies.push({ ...ceremony, _source: file });
}
for (const file of ["major-awards.json", "more-catalog.json", "extra-catalog.json", "density-pack.json"]) {
  for (const ceremony of read(file).ceremonies ?? []) ceremonies.push({ ...ceremony, _source: file });
}

const news = read("auteur-news.json").map((item) => ({ ...item, _source: "auteur-news.json" }));

function posterIndex() {
  const files = new Set();
  const dir = join(ROOT, "public", "posters");
  for (const name of readdirSync(dir)) {
    const match = name.match(/^(.+)\.(jpe?g|png|webp)$/i);
    if (match) files.add(match[1]);
  }
  return files;
}

test("film records have required fields and usable types", () => {
  const errors = [];
  let emptySynopsis = 0;
  let emptyDirectors = 0;
  let emptyGenres = 0;
  for (const film of catalogFilms) {
    const where = `${film._source}:${film.id}`;
    for (const key of FILM_REQUIRED) {
      if (film[key] === undefined || film[key] === null) errors.push(`${where}: missing ${key}`);
    }
    if (typeof film.id !== "string" || !film.id.trim()) errors.push(`${where}: id must be a non-empty string`);
    if (typeof film.title !== "string" || !film.title.trim()) errors.push(`${where}: title must be a non-empty string`);
    if (typeof film.year !== "number" || !Number.isInteger(film.year) || film.year < 1888 || film.year > 2100) {
      errors.push(`${where}: year must be an integer from 1888 to 2100 (got ${film.year})`);
    }
    if (typeof film.synopsis !== "string") errors.push(`${where}: synopsis must be a string`);
    else if (!film.synopsis.trim()) emptySynopsis += 1;
    if (!Array.isArray(film.directors)) errors.push(`${where}: directors must be an array`);
    else if (film.directors.length === 0) emptyDirectors += 1;
    if (!Array.isArray(film.cast)) errors.push(`${where}: cast must be an array`);
    if (!Array.isArray(film.genres)) errors.push(`${where}: genres must be an array`);
    else if (film.genres.length === 0) emptyGenres += 1;
    if (!Array.isArray(film.streaming)) errors.push(`${where}: streaming must be an array`);
    else {
      for (const [index, release] of film.streaming.entries()) {
        if (!release || typeof release !== "object") errors.push(`${where}: streaming[${index}] must be an object`);
        else {
          if (typeof release.platform !== "string" || !release.platform.trim()) {
            errors.push(`${where}: streaming[${index}].platform is required`);
          }
          if (typeof release.status !== "string" || !release.status.trim()) {
            errors.push(`${where}: streaming[${index}].status is required`);
          }
        }
      }
    }
  }
  if (emptySynopsis) console.warn(`warn: ${emptySynopsis} film(s) have an empty synopsis string`);
  if (emptyDirectors) console.warn(`warn: ${emptyDirectors} film(s) have an empty directors array`);
  if (emptyGenres) console.warn(`warn: ${emptyGenres} film(s) have an empty genres array`);
  assert.deepEqual(errors, []);
});

test("film slugs are unique across catalogs", () => {
  const seen = new Map();
  const duplicates = [];
  for (const film of catalogFilms) {
    if (seen.has(film.id)) duplicates.push(`${film.id} in ${seen.get(film.id)} and ${film._source}`);
    else seen.set(film.id, film._source);
  }
  assert.deepEqual(duplicates, []);
  assert.equal(seen.size, catalogFilms.length);
});

test("unexpected film slugs are lowercase ascii", () => {
  const unexpected = catalogFilms
    .filter((film) => !ASCII_SLUG.test(film.id) && !KNOWN_NON_ASCII_SLUGS.has(film.id))
    .map((film) => `${film._source}:${film.id}`);
  assert.deepEqual(unexpected, []);
});

test("all film slugs are lowercase ascii", { todo: "extra-catalog.json id ketticè is not lowercase ascii" }, () => {
  const bad = catalogFilms.filter((film) => !ASCII_SLUG.test(film.id)).map((film) => film.id);
  assert.deepEqual(bad, []);
});

test("dates are real YYYY-MM-DD values and timestamps parse", () => {
  const errors = [];
  for (const film of catalogFilms) {
    for (const [index, release] of (film.streaming ?? []).entries()) {
      const where = `${film._source}:${film.id} streaming[${index}]`;
      if (release.date !== undefined && !isRealDate(release.date)) errors.push(`${where}: date ${release.date}`);
      if (release.publishedAt !== undefined && !PUBLISHED_AT.test(release.publishedAt)) {
        errors.push(`${where}: publishedAt ${release.publishedAt}`);
      }
      if (release.status === "announced") {
        if (!release.date || !isRealDate(release.date)) errors.push(`${where}: announced requires a real date`);
        if (!release.publishedAt || !ANNOUNCED_PUBLISHED_AT.test(release.publishedAt)) {
          errors.push(`${where}: announced publishedAt must be +08:00`);
        }
      }
      if (release.sourcePublishedAt !== undefined && !PUBLISHED_AT.test(release.sourcePublishedAt)) {
        errors.push(`${where}: sourcePublishedAt ${release.sourcePublishedAt}`);
      }
    }
  }
  for (const item of news) {
    const where = `${item._source}:${item.id}`;
    if (!isRealDate(item.date)) errors.push(`${where}: date ${item.date}`);
    if (item.publishedAt !== undefined && !PUBLISHED_AT.test(item.publishedAt)) {
      errors.push(`${where}: publishedAt ${item.publishedAt}`);
    }
    if (item.sourcePublishedAt !== undefined && !PUBLISHED_AT.test(item.sourcePublishedAt)) {
      errors.push(`${where}: sourcePublishedAt ${item.sourcePublishedAt}`);
    }
  }
  for (const ceremony of ceremonies) {
    const where = `${ceremony._source}:${ceremony.id}`;
    if (ceremony.date !== undefined && !isRealDate(ceremony.date)) errors.push(`${where}: date ${ceremony.date}`);
    if (typeof ceremony.year !== "number" || !Number.isInteger(ceremony.year)) errors.push(`${where}: year ${ceremony.year}`);
    for (const [index, nomination] of (ceremony.nominations ?? []).entries()) {
      if (nomination?.date !== undefined && !isRealDate(nomination.date)) {
        errors.push(`${where}: nominations[${index}].date ${nomination.date}`);
      }
    }
  }
  assert.deepEqual(errors, []);
});

test("local poster files exist for every poster path", () => {
  const onDisk = posterIndex();
  const errors = [];
  let missingPoster = 0;
  const accepted = new Set(
    readOpt("poster-placeholder-accepted.json", []).map((entry) => (typeof entry === "string" ? entry : entry.id)),
  );
  const seen = new Set();
  const unaccepted = [];
  for (const film of catalogFilms) {
    if (seen.has(film.id)) continue;
    seen.add(film.id);
    if (!film.poster) {
      missingPoster += 1;
      if (!accepted.has(film.id)) unaccepted.push(film.id);
      continue;
    }
    if (typeof film.poster !== "string") {
      errors.push(`${film._source}:${film.id}: poster must be a string`);
      continue;
    }
    if (/^https?:\/\//i.test(film.poster)) {
      errors.push(`${film._source}:${film.id}: poster is a remote URL`);
      continue;
    }
    if (!film.poster.startsWith("/posters/")) {
      errors.push(`${film._source}:${film.id}: poster is not under /posters/: ${film.poster}`);
      continue;
    }
    const base = film.poster.replace(/^\/posters\//, "").replace(/\.(jpe?g|png|webp)$/i, "");
    if (!/\.(jpe?g|png|webp)$/i.test(film.poster) || !onDisk.has(base)) {
      errors.push(`${film._source}:${film.id}: poster file missing: ${film.poster}`);
    } else if (!existsSync(join(ROOT, "public", film.poster))) {
      errors.push(`${film._source}:${film.id}: poster path missing on disk: ${film.poster}`);
    }
  }
  if (missingPoster) console.warn(`warn: ${missingPoster} film(s) have no poster field`);
  if (unaccepted.length) {
    console.warn(
      `warn: ${unaccepted.length} film(s) without poster are not in poster-placeholder-accepted.json: ${unaccepted.join(", ")}`,
    );
  }
  assert.deepEqual(errors, []);
});

test("news items have required fields and unique ids", () => {
  const errors = [];
  const seen = new Set();
  for (const item of news) {
    const where = `${item._source}:${item.id}`;
    for (const key of NEWS_REQUIRED) {
      if (typeof item[key] !== "string" || !item[key].trim()) errors.push(`${where}: missing ${key}`);
    }
    if (seen.has(item.id)) errors.push(`${where}: duplicate news id`);
    seen.add(item.id);
    if (item.id && !ASCII_SLUG.test(item.id)) errors.push(`${where}: news id is not a lowercase ascii slug`);
  }
  assert.deepEqual(errors, []);
  assert.ok(news.length > 0);
});

test("ceremonies have required fields and unique ids", () => {
  const errors = [];
  const seen = new Set();
  for (const ceremony of ceremonies) {
    const where = `${ceremony._source}:${ceremony.id}`;
    for (const key of CEREMONY_REQUIRED) {
      if (ceremony[key] === undefined || ceremony[key] === null || ceremony[key] === "") {
        errors.push(`${where}: missing ${key}`);
      }
    }
    if (typeof ceremony.id === "string") {
      if (seen.has(ceremony.id)) errors.push(`${where}: duplicate ceremony id`);
      seen.add(ceremony.id);
    }
    if (!Array.isArray(ceremony.nominations)) errors.push(`${where}: nominations must be an array`);
  }
  assert.deepEqual(errors, []);
  assert.ok(ceremonies.length > 0);
});
