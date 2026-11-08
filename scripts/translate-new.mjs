#!/usr/bin/env node
// translate-new.mjs — English translation filler for the movie news site.
//
// Scans film-copy.json / films.json / streaming catalogs / auteur-news.json for
// entries missing English fields (synopsisEn / backgroundEn / summaryEn /
// detailEn) and fills them via the WorkBuddy DeepSeek gateway on ECS
// (OpenAI-compatible, model workbuddy-ai/deepseek-v4.1-flash — free tier,
// NOT the -sg variant which costs credits).
//
// Wiring (cron / ingest): run AFTER the catalog ingest scripts
// (fetch_whatson_netflix.py, fetch_motn_upcoming.py, ingest_movie_peek_resources.py,
// build-film-copy.mjs) and BEFORE `npm run build`. It only adds *En fields;
// it never touches Chinese fields and never overwrites existing English text.
// Usage:
//   node scripts/translate-new.mjs            # translate everything missing
//   node scripts/translate-new.mjs --dry-run  # list what would be translated
//   node scripts/translate-new.mjs --limit 20 # cap the number of items
//   node scripts/translate-new.mjs --only auteur-news.json
//
// Gateway: http://127.0.0.1:3425/v1 (SSH tunnel to the ECS Magpie gateway).
// If the tunnel is down, restart it with:
//   ssh -f -N -L 3425:127.0.0.1:3425 -i <ecs-key> -o IdentitiesOnly=yes \
//     -o UserKnownHostsFile=/home/hatch/.ssh/known_hosts \
//     -o ExitOnForwardFailure=yes root@100.121.184.99
// No API key or secret is read or written by this script.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const GATEWAY = process.env.MAGPIE_BASE_URL || "http://127.0.0.1:3425/v1";
const MODEL = process.env.MAGPIE_MODEL || "workbuddy-ai/deepseek-v4.1-flash";
const BATCH = 8;

const CATALOG_ORDER = [
  "major-awards.json",
  "more-catalog.json",
  "extra-catalog.json",
  "density-pack.json",
  "wts-streaming-catalog.json",
  "won-streaming-catalog.json",
  "motn-streaming-catalog.json",
  "movie-peek-catalog.json",
];

const read = (name) => JSON.parse(readFileSync(join(DATA, name), "utf8"));
const write = (name, data) =>
  writeFileSync(join(DATA, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");

/** Same rule as src/lib/data.ts isStreamingMetaSynopsis: a short streaming-schedule
 *  blurb is not plot copy and is never shown as a synopsis, so don't translate it. */
function isStreamingMetaSynopsis(text, title) {
  const s = (text || "").trim();
  if (!s) return false;
  if (s.length > 120) return false;
  const t = (title || "").trim();
  const mentionsTitle = t
    ? s.includes(t) || s.includes(`《${t}》`)
    : /《.+》/.test(s);
  const meta =
    /流媒体定档|片夜数据|以平台官方为准|美国区定档|区定档/.test(s) &&
    !/执导|主演|讲述|故事|改编|获奖|入围|拍摄|取材/.test(s);
  return Boolean(mentionsTitle && meta);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateBatch(items) {
  // items: [{ key, zh, hint }] — hint is extra context (e.g. official English title).
  const payload = items.map((it, i) => ({ i, zh: it.zh, hint: it.hint || "" }));
  const sys =
    "You translate Chinese film copy into natural, publishable English for a film-news site. " +
    "Rules: translate the meaning, not word-for-word; keep it concise and factual; " +
    "do NOT translate film titles — if a `hint` gives the official English title, use that exact title when the film is named; " +
    "keep streaming platform names (Netflix, MUBI, Apple TV+, Max, Prime Video, Disney+, Criterion Channel) and festival names in their official English forms; " +
    "keep all dates, numbers and scores unchanged; " +
    "for person names, use the standard English name only if it is unambiguously the well-known international name, otherwise keep the original Chinese name as-is (never invent a transliteration); " +
    "return ONLY a JSON array of objects {\"i\": <index>, \"en\": \"<translation>\"} with one entry per input item, in the same order.";
  const body = {
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: JSON.stringify(payload) },
    ],
  };
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${GATEWAY}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`gateway HTTP ${res.status}`);
      const data = await res.json();
      const text = (data.choices?.[0]?.message?.content || "").trim();
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) throw new Error(`no JSON array in reply: ${text.slice(0, 120)}`);
      const out = JSON.parse(m[0]);
      if (!Array.isArray(out) || out.length !== items.length) {
        throw new Error(`expected ${items.length} translations, got ${out?.length}`);
      }
      const byIdx = new Map(out.map((o) => [o.i, o.en]));
      return items.map((it, i) => {
        const en = (byIdx.get(i) || "").trim();
        if (!en) throw new Error(`empty translation for item ${i} (${it.key})`);
        return en;
      });
    } catch (err) {
      lastErr = err;
      await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

/** Fixed English forms for the handful of verified awards (proper nouns). */
const AWARD_EN = {
  "戛纳电影节": "Cannes Film Festival",
  "威尼斯电影节": "Venice Film Festival",
  "洛卡诺电影节": "Locarno Film Festival",
  "哥谭奖": "Gotham Awards",
  "金棕榈奖": "Palme d'Or",
  "评审团大奖": "Grand Jury Prize",
  "评审团大奖（银狮奖）": "Grand Jury Prize (Silver Lion)",
  "最佳国际影片": "Best International Film",
};
function awardCategoryEn(cat, filmId) {
  if (AWARD_EN[cat]) return AWARD_EN[cat];
  const m = cat.match(/^最佳导演（(.+)）$/);
  if (m) return `Best Director (${m[1]})`;
  const p = cat.match(/^最佳表演（(.+)）$/);
  if (p) return `Best Performance (${p[1]})`;
  return null; // unknown pattern: leave untranslated, flagged in the report
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.split("=")[1] : null;

  const filmCopy = read("film-copy.json");
  const filmsJson = read("films.json");
  const catalogs = CATALOG_ORDER.map((name) => ({ name, data: read(name) }));
  const auteurNews = read("auteur-news.json");
  const awards = read("verified-film-awards.json");

  // Determine the winning synopsis source per film id (same precedence as
  // src/lib/data.ts: film-copy overrides, then first catalog in spread order).
  const winSource = new Map(); // filmId -> { file, entry }
  const filmsJsonById = new Map(filmsJson.map((f) => [f.id, f]));
  const catalogById = new Map(); // filmId -> { file, entry } (first in order)
  for (const { name, data } of catalogs) {
    const list = Array.isArray(data) ? data : data.films || [];
    for (const f of list) {
      if (!catalogById.has(f.id)) catalogById.set(f.id, { file: name, entry: f });
    }
  }
  const allIds = new Set([
    ...Object.keys(filmCopy),
    ...filmsJsonById.keys(),
    ...catalogById.keys(),
  ]);
  for (const id of allIds) {
    const copy = filmCopy[id];
    if (copy?.synopsis?.trim()) {
      winSource.set(id, { file: "film-copy.json", entry: copy });
    } else if (filmsJsonById.get(id)?.synopsis?.trim()) {
      winSource.set(id, { file: "films.json", entry: filmsJsonById.get(id) });
    } else if (catalogById.get(id)?.entry?.synopsis?.trim()) {
      winSource.set(id, catalogById.get(id));
    }
  }

  // Collect translation jobs: { file, id, field, zh, hint }
  const jobs = [];
  const push = (file, id, field, zh, hint) => {
    if (!zh?.trim()) return;
    if (only && file !== only) return;
    jobs.push({ file, id, field, zh: zh.trim(), hint: hint || "" });
  };
  const titleOf = (id) => {
    const copy = filmCopy[id];
    if (copy?.title) return copy.title;
    return filmsJsonById.get(id)?.title || catalogById.get(id)?.entry?.title || "";
  };
  const titleEnOf = (id) => {
    const copy = filmCopy[id];
    if (copy?.titleEn) return copy.titleEn;
    return filmsJsonById.get(id)?.titleEn || catalogById.get(id)?.entry?.titleEn || "";
  };

  // film-copy: synopsis + background (only where the copy is the winning source
  // for synopsis; background only exists in film-copy).
  for (const [id, copy] of Object.entries(filmCopy)) {
    if (!copy.synopsisEn && copy.synopsis?.trim() && !isStreamingMetaSynopsis(copy.synopsis, copy.title || titleOf(id))) {
      push("film-copy.json", id, "synopsisEn", copy.synopsis, titleEnOf(id));
    }
    if (!copy.backgroundEn && copy.background?.trim()) {
      push("film-copy.json", id, "backgroundEn", copy.background, titleEnOf(id));
    }
  }
  // films.json + catalogs: synopsis only where this file is the winning source.
  for (const [id, f] of filmsJsonById) {
    const win = winSource.get(id);
    if (win?.file === "films.json" && !f.synopsisEn && f.synopsis?.trim() && !isStreamingMetaSynopsis(f.synopsis, f.title)) {
      push("films.json", id, "synopsisEn", f.synopsis, titleEnOf(id));
    }
  }
  for (const { name, data } of catalogs) {
    const list = Array.isArray(data) ? data : data.films || [];
    for (const f of list) {
      const win = winSource.get(f.id);
      if (win?.file === name && win.entry === f && !f.synopsisEn && f.synopsis?.trim() && !isStreamingMetaSynopsis(f.synopsis, f.title)) {
        push(name, f.id, "synopsisEn", f.synopsis, titleEnOf(f.id));
      }
    }
  }
  // auteur-news: summary + detail.
  for (const item of auteurNews) {
    if (!item.summaryEn && item.summary?.trim()) {
      const film = filmsJsonById.get(item.filmId) || catalogById.get(item.filmId)?.entry;
      push("auteur-news.json", item.id, "summaryEn", item.summary, film?.titleEn || "");
    }
    if (!item.detailEn && item.detail?.trim()) {
      const film = filmsJsonById.get(item.filmId) || catalogById.get(item.filmId)?.entry;
      push("auteur-news.json", item.id, "detailEn", item.detail, film?.titleEn || "");
    }
  }

  const todo = jobs.slice(0, limit);
  const byFile = {};
  for (const j of todo) byFile[j.file] = (byFile[j.file] || 0) + 1;
  console.log(`translate-new: ${todo.length} item(s) to translate (${JSON.stringify(byFile)})${dryRun ? " [dry-run]" : ""}`);
  if (dryRun) {
    for (const j of todo.slice(0, 40)) console.log(`  ${j.file} ${j.id} ${j.field}: ${j.zh.slice(0, 60)}…`);
    if (todo.length > 40) console.log(`  … and ${todo.length - 40} more`);
    return;
  }

  // Verified awards: fixed-map only, no gateway call.
  let awardFilled = 0;
  const awardMissing = [];
  for (const a of awards) {
    if (!a.festivalEn && AWARD_EN[a.festival]) { a.festivalEn = AWARD_EN[a.festival]; awardFilled++; }
    else if (!a.festivalEn) awardMissing.push(`festival: ${a.festival}`);
    if (!a.categoryEn) {
      const en = awardCategoryEn(a.category, a.filmId);
      if (en) { a.categoryEn = en; awardFilled++; }
      else awardMissing.push(`category: ${a.category}`);
    }
  }
  if (awardFilled) write("verified-film-awards.json", awards);
  if (awardMissing.length) console.log(`award English missing (needs a decision): ${[...new Set(awardMissing)].join("; ")}`);

  // Translate in batches, then write back grouped by file.
  const results = new Map(); // key -> en
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const ens = await translateBatch(batch);
    batch.forEach((job, k) => results.set(`${job.file}|${job.id}|${job.field}`, ens[k]));
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length} translated`);
  }

  // Sanity: flag outputs that still contain CJK (translation likely failed).
  const cjk = /[\u4e00-\u9fff]/;
  let flagged = 0;
  for (const [key, en] of results) {
    if (cjk.test(en)) { console.log(`  warn: output still contains Chinese: ${key}: ${en.slice(0, 80)}`); flagged++; }
  }

  const apply = (file, mutate) => {
    const data = read(file);
    mutate(data);
    write(file, data);
  };
  const setEn = (obj, field, en) => { obj[field] = en; };

  apply("film-copy.json", (data) => {
    for (const [key, en] of results) {
      const [file, id, field] = key.split("|");
      if (file === "film-copy.json" && data[id]) setEn(data[id], field, en);
    }
  });
  apply("films.json", (data) => {
    for (const f of data) {
      const en = results.get(`films.json|${f.id}|synopsisEn`);
      if (en) setEn(f, "synopsisEn", en);
    }
  });
  for (const { name } of catalogs) {
    apply(name, (data) => {
      const list = Array.isArray(data) ? data : data.films || [];
      for (const f of list) {
        const en = results.get(`${name}|${f.id}|synopsisEn`);
        if (en) setEn(f, "synopsisEn", en);
      }
    });
  }
  apply("auteur-news.json", (data) => {
    for (const item of data) {
      for (const field of ["summaryEn", "detailEn"]) {
        const en = results.get(`auteur-news.json|${item.id}|${field}`);
        if (en) setEn(item, field, en);
      }
    }
  });

  console.log(`done: ${results.size} English field(s) written, ${flagged} flagged for review, ${awardFilled} award label(s) filled.`);
}

main().catch((err) => {
  console.error(`translate-new failed: ${err.message}`);
  process.exit(1);
});
