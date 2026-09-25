#!/usr/bin/env node
/**
 * Download missing local posters for timeline films.
 * Sources: existing poster-urls.json, TMDB pages (by tmdb-ids), Wikimedia URLs.
 * Outputs JPEG under public/posters/{id}.jpg
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "posters");

const tmdbIds = JSON.parse(fs.readFileSync(path.join(root, "src/data/tmdb-ids.json"), "utf8"));
const posterUrls = JSON.parse(fs.readFileSync(path.join(root, "src/data/poster-urls.json"), "utf8"));

const EXTRA_TMDB = {
  "paper-tiger": null, // resolve via search HTML
  "tender-loving-care": null,
  "woman-unknown": null,
  "naza": null,
  "galerna": null,
  "lovers-go-home": null,
  "a-foggy-tale": null,
  "goodbye-ufo": null,
  "love-like-mine": null,
  "family-matters": null,
  "fruit-gathering": null,
  "you-dont-belong-here": null,
  "nowhere-to-lay-eyes": null,
  "the-riverbank": null,
  "atlantic": null,
  "salvation": null,
  "queen-at-sea": null,
  "everybody-digs-bill-evans": null,
  "rose-berlin": null,
  "nina-roza": null,
  "honorary-yeoh": null, // use film still
  "tonight-will-happen": null,
  "mr-nelson": null,
  "bunker": null,
  "company": null,
  "primetime": null,
  "place-to-heal": null,
  "dau": null,
  "good-little-soldier": null,
  "fire-inside": null,
  "sheep-in-the-box": null,
  "nagi-notes": null,
  "bitter-christmas": null,
  "parallel-tales": null,
  "moulin": null,
  "the-beloved": null,
  "box-mystery": null,
  "halima": null,
  "glimmer-girl": null,
  "the-guest-kv": null,
  "ketticè": null,
  "ghost-song": null,
  "the-housewife": null,
};

const SEARCH_QUERIES = {
  "paper-tiger": "Paper Tiger James Gray",
  "tender-loving-care": "Tender Loving Care Mike Leigh",
  "woman-unknown": "Woman Unknown May el-Toukhy",
  "naza": "NAZA Yuval Abraham",
  "galerna": "Galerna Tatiana Huezo",
  "lovers-go-home": "Lovers Go Home Juan Sebastian Mesa",
  "goodbye-ufo": "Goodbye UFO",
  "love-like-mine": "A Love Like Mine Hong Kong",
  "family-matters": "Family Matters Zeng Jingli",
  "you-dont-belong-here": "You Don't Belong Here Florin Serban",
  "nowhere-to-lay-eyes": "Nowhere to Lay My Eyes Hong Sang-soo",
  "the-riverbank": "The Riverbank Locarno",
  "atlantic": "Atlantic Zhong Kaifeng",
  "salvation": "Salvation Emin Alper",
  "queen-at-sea": "Queen at Sea Lance Hammer",
  "everybody-digs-bill-evans": "Everybody Digs Bill Evans",
  "rose-berlin": "Rose Markus Schleinzer",
  "nina-roza": "Nina Roza",
  "tonight-will-happen": "Succederà questa notte Moretti",
  "mr-nelson": "Mr. Nelson Did You Kill People Tsukamoto",
  "bunker": "Bunker Florian Zeller",
  "company": "Company Casey Affleck",
  "primetime": "Primetime Lance Oppenheim",
  "place-to-heal": "A Place to Heal Cedric Kahn",
  "dau": "DAU Lev Landau Khrzhanovsky",
  "good-little-soldier": "Un bon petit soldat Brize",
  "fire-inside": "Il fuoco che ti porti dentro",
  "sheep-in-the-box": "Sheep in the Box Kore-eda",
  "nagi-notes": "Nagi Notes Fukada",
  "bitter-christmas": "Bitter Christmas Almodovar",
  "parallel-tales": "Parallel Tales Farhadi",
  "moulin": "Moulin Nemes",
  "the-beloved": "The Beloved Sorogoyen",
  "box-mystery": "Mystery in a Carton Zhang Songwen",
  "halima": "Halima Yassine Idrissi",
  "glimmer-girl": "Glimmer Girl",
  "the-guest-kv": "The Guest Maziar Miri",
  "fruit-gathering": "Fruit Gathering Aung Phyoe",
  "ketticè": "Ketticè Monica Bellucci",
  "ghost-song": "Ghost Song Geister",
  "the-housewife": "The Housewife film",
  "honorary-yeoh": "Everything Everywhere All at Once",
  "busan-jury-2026-zhang-yimou": "Raise the Red Lantern",
  "busan-31-cuaron": "Roma Cuaron",
  "venice-jury-2026": "The Lost Daughter Gyllenhaal",
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
