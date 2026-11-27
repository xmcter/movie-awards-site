#!/usr/bin/env node
// fill-tmdb-ratings.mjs — build-time TMDB rating filler.
//
// 用途：流媒体质量闸的 TMDB 兜底（用户 2026-11-27 定：TMDB ≥7 且投票 ≥50）
// 需要每部片的 TMDB 评分/投票数。catalog 里原本不存 TMDB 评分，本脚本在
// 构建前把 tmdbRating { score, votes, tmdbId, updatedAt } 补在影片所属
// catalog 上（接法与 fill-douban-ratings.mjs 一致：采入后、构建前单独跑，
// 不进 prebuild）。
//
// 范围：有 streaming 条目且年份在流媒体新片年窗内（>= 当前年 - 2）的片子，
// 且尚无 tmdbRating。已有非空值一律跳过（重跑只补新增）。
//
// TMDB id 解析：先查 src/data/tmdb-ids.json；没有才用英文原名 + 年份搜索。
// 搜索结果必须片名（original_title / title，归一化后）与年份都对得上才采用，
// 对不上就记一行日志跳过，绝不猜。解析到的新 id 回写 tmdb-ids.json。
//
// 密钥：环境变量 TMDB_API_KEY 优先；否则读本机凭据文件
// ~/workspace/sync/agent-mine/dev-projects/credentials/tmdb_moviehome.env
// （或 TMDB_CREDENTIALS_FILE 指定的路径）。密钥值绝不打印、不写进任何文件。
// 网络失败、HTTP 非 200 只记日志跳过；脚本始终以 0 退出。
//
// Usage:
//   node scripts/fill-tmdb-ratings.mjs
//   node scripts/fill-tmdb-ratings.mjs --dry-run
//   node scripts/fill-tmdb-ratings.mjs --limit 10

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");

// 与 src/lib/data.ts 的合并顺序一致。同一 id 只应出现在一个文件里（validate 会查）。
const CATALOG_FILES = [
  "films.json",
  "major-awards.json",
  "more-catalog.json",
  "extra-catalog.json",
  "density-pack.json",
  "wts-streaming-catalog.json",
  "won-streaming-catalog.json",
  "motn-streaming-catalog.json",
  "movie-peek-catalog.json",
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit"));
const limit = limitArg ? Number(limitArg.split("=")[1] || args[args.indexOf(limitArg) + 1]) : Infinity;

function loadApiKey() {
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY.trim();
  const credPath =
    process.env.TMDB_CREDENTIALS_FILE ||
    join(homedir(), "workspace/sync/agent-mine/dev-projects/credentials/tmdb_moviehome.env");
  try {
    const text = readFileSync(credPath, "utf8");
    const m = text.match(/^TMDB_API_KEY\s*=\s*(\S+)\s*$/m);
    if (m) return m[1];
  } catch {
    /* fall through */
  }
  return null;
}

const apiKey = loadApiKey();
if (!apiKey) {
  console.log("fill-tmdb: no TMDB API key available (env/credentials), skipping");
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(pathname, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function normalizeTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function resolveTmdbId(film, knownIds) {
  if (knownIds[film.id]) return knownIds[film.id];
  const query = film.titleEn || film.title;
  if (!query || typeof film.year !== "number") return null;
  const data = await tmdb("/search/movie", { query, year: String(film.year), include_adult: "false" });
  const want = normalizeTitle(query);
  const candidates = (data.results || []).filter((r) => {
    if (!r.release_date || Number(r.release_date.slice(0, 4)) !== film.year) return false;
    return normalizeTitle(r.original_title) === want || normalizeTitle(r.title) === want;
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
  return candidates[0].id;
}

function writeJsonAtomic(path, value) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmp, path);
}

const tmdbIdsPath = join(DATA, "tmdb-ids.json");
const knownIds = JSON.parse(readFileSync(tmdbIdsPath, "utf8"));
const minYear = new Date().getFullYear() - 2;
const nowIso = new Date().toISOString();

let processed = 0;
let filled = 0;
let newIds = 0;
let skippedNoMatch = 0;
let failed = 0;
let idsDirty = false;

for (const file of CATALOG_FILES) {
  const path = join(DATA, file);
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    continue;
  }
  const items = Array.isArray(catalog) ? catalog : catalog.films;
  if (!Array.isArray(items)) continue;
  let dirty = false;
  for (const film of items) {
    if (processed >= limit) break;
    if (!film || film.tmdbRating) continue;
    if (!Array.isArray(film.streaming) || film.streaming.length === 0) continue;
    if (typeof film.year !== "number" || film.year < minYear) continue;
    processed += 1;
    try {
      const tmdbId = await resolveTmdbId(film, knownIds);
      await sleep(120);
      if (!tmdbId) {
        skippedNoMatch += 1;
        console.log(`fill-tmdb: no exact TMDB match for ${film.id} (${film.titleEn || film.title}, ${film.year})`);
        continue;
      }
      const detail = await tmdb(`/movie/${tmdbId}`);
      await sleep(120);
      film.tmdbRating = {
        score: typeof detail.vote_average === "number" ? detail.vote_average : 0,
        votes: typeof detail.vote_count === "number" ? detail.vote_count : 0,
        tmdbId,
        updatedAt: nowIso,
      };
      if (!knownIds[film.id]) {
        knownIds[film.id] = tmdbId;
        idsDirty = true;
        newIds += 1;
      }
      dirty = true;
      filled += 1;
    } catch (err) {
      failed += 1;
      console.log(`fill-tmdb: ${film.id} failed: ${err.message}`);
    }
  }
  if (dirty && !dryRun) writeJsonAtomic(path, catalog);
}

if (idsDirty && !dryRun) writeJsonAtomic(tmdbIdsPath, knownIds);
console.log(
  `fill-tmdb: processed=${processed} filled=${filled} newIds=${newIds} noMatch=${skippedNoMatch} failed=${failed}${dryRun ? " (dry-run)" : ""}`,
);
