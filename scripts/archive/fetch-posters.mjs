#!/usr/bin/env node
/**
 * ARCHIVED 2026-11-08 — moved to scripts/archive/fetch-posters.mjs
 *
 * 归档原因：待查清单（EXTRA_TMDB、SEARCH_QUERIES）已过期，且本脚本没有接入
 * package.json 或其他入口。2026-11-08 对照 public/posters：清单里每一项都已有
 * 本地海报文件。existingPoster() 把大于 2KB 的文件当成已有并跳过，所以这份
 * 清单不会再去补图。选择归档，不并入现行抓取流程。两份清单已清空。
 *
 * 画质核查另记：galerna、lovers-go-home 磁盘上仍是纯色标题占位图，没有找到
 * 可替换的正式海报，待人工处理。本脚本不再自动搜索它们。
 *
 * 原用途：Download missing local posters for timeline films.
 * Sources: existing poster-urls.json, TMDB pages (by tmdb-ids), Wikimedia URLs.
 * Outputs JPEG under public/posters/{id}.jpg
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// File lives in scripts/archive/, so the repo root is two levels up.
const root = path.join(__dirname, "..", "..");
const outDir = path.join(root, "public", "posters");

const tmdbIds = JSON.parse(fs.readFileSync(path.join(root, "src/data/tmdb-ids.json"), "utf8"));
const posterUrls = JSON.parse(fs.readFileSync(path.join(root, "src/data/poster-urls.json"), "utf8"));

const EXTRA_TMDB = {
  // 2026-11-08：原清单各项在 public/posters 均已有文件，已移出。
};

const SEARCH_QUERIES = {
  // 2026-11-08：原清单各项在 public/posters 均已有文件，已移出。
};

const UA = "Mozilla/5.0 (compatible; movie-awards-site/1.0; editorial posters)";

function existingPoster(id) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const p = path.join(outDir, id + ext);
    if (fs.existsSync(p) && fs.statSync(p).size > 2000) return p;
  }
  return null;
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

async function fetchBin(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function extractPosterFromTmdbHtml(html) {
  // Prefer poster_path style on og:image or media.themoviedb poster
  const og = html.match(/property="og:image"\s+content="([^"]+)"/i);
  if (og && /themoviedb\.org/.test(og[1]) && !/avatar|logo/i.test(og[1])) {
    return og[1].replace(/\/t\/p\/w\d+/, "/t/p/w500");
  }
  const m = html.match(/https:\/\/(?:media|image)\.themoviedb\.org\/t\/p\/w(?:300|342|500|780)\/([A-Za-z0-9]+\.jpg)/);
  if (m) return `https://image.tmdb.org/t/p/w500/${m[1]}`;
  const rel = html.match(/\/t\/p\/w(?:300|342|500|780)\/([A-Za-z0-9]+\.jpg)/);
  if (rel) return `https://image.tmdb.org/t/p/w500/${rel[1]}`;
  return null;
}

async function resolveTmdbIdBySearch(query) {
  const url = `https://www.themoviedb.org/search?query=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  const m = html.match(/href="\/movie\/(\d+)[^"]*"/);
  return m ? Number(m[1]) : null;
}

async function posterUrlForTmdbId(id) {
  const html = await fetchText(`https://www.themoviedb.org/movie/${id}`);
  return extractPosterFromTmdbHtml(html);
}

function toJpeg(srcPath, destPath) {
  execSync(
    `ffmpeg -y -i ${JSON.stringify(srcPath)} -vf "scale=500:-2" -q:v 4 ${JSON.stringify(destPath)}`,
    { stdio: "pipe" }
  );
}

async function savePoster(id, url) {
  const tmp = path.join(outDir, `.tmp-${id}`);
  const buf = await fetchBin(url);
  fs.writeFileSync(tmp, buf);
  const dest = path.join(outDir, `${id}.jpg`);
  try {
    toJpeg(tmp, dest);
  } catch {
    // already jpeg-ish
    fs.copyFileSync(tmp, dest);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
  const size = fs.statSync(dest).size;
  if (size < 1500) throw new Error(`too small ${size}`);
  return dest;
}

function collectNeededIds() {
  const packs = [
    JSON.parse(fs.readFileSync(path.join(root, "src/data/films.json"), "utf8")),
    JSON.parse(fs.readFileSync(path.join(root, "src/data/major-awards.json"), "utf8")).films,
    JSON.parse(fs.readFileSync(path.join(root, "src/data/more-catalog.json"), "utf8")).films,
    JSON.parse(fs.readFileSync(path.join(root, "src/data/extra-catalog.json"), "utf8")).films,
    JSON.parse(fs.readFileSync(path.join(root, "src/data/density-pack.json"), "utf8")).films || [],
  ];
  const ids = new Set();
  for (const list of packs) for (const f of list) ids.add(f.id);
  // skip meta ceremony placeholders that aren't visual films
  for (const skip of ["golden-horse-63", "oscars-99"]) ids.delete(skip);
  return [...ids];
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const needed = collectNeededIds();
  const report = { ok: [], fail: [], skip: [] };

  for (const id of needed) {
    if (existingPoster(id)) {
      report.skip.push(id);
      continue;
    }
    try {
      let url = posterUrls[id] || null;
      let tmdbId = tmdbIds[id] || EXTRA_TMDB[id] || null;
      if (!url && !tmdbId && SEARCH_QUERIES[id]) {
        await sleep(400);
        tmdbId = await resolveTmdbIdBySearch(SEARCH_QUERIES[id]);
        console.log("search", id, "->", tmdbId);
      }
      if (!url && tmdbId) {
        await sleep(350);
        url = await posterUrlForTmdbId(tmdbId);
      }
      if (!url) throw new Error("no url");
      await sleep(200);
      await savePoster(id, url);
      console.log("OK", id, url.slice(0, 80));
      report.ok.push(id);
      // remember tmdb id
      if (tmdbId && !tmdbIds[id]) tmdbIds[id] = tmdbId;
    } catch (e) {
      console.warn("FAIL", id, e.message);
      report.fail.push({ id, err: e.message });
    }
  }

  fs.writeFileSync(path.join(root, "src/data/tmdb-ids.json"), JSON.stringify(tmdbIds, null, 2) + "\n");
  console.log("\nDONE ok=%d skip=%d fail=%d", report.ok.length, report.skip.length, report.fail.length);
  if (report.fail.length) console.log(report.fail);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
