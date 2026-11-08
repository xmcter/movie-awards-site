// fetch_wts.mjs — When To Stream (whentostream.com) WP REST 拉取 + 分类 + 候选提取
// 仓库内版本（M-N8，2026-11-09 落仓；原版在 goals hidden_files/wts-ingest/fetch-wts.mjs）。
// 只做拉取/分类/提取，写 candidates JSON，不写 catalog 文件；中文标题翻译与
// 入库由 agent 复核后执行（流程见仓库根目录 WTS_INGEST.md）。
// 规则（2026-11-05 已用首批 b336de2 实测核对）：
//   源：https://whentostream.com/wp-json/wp/v2/posts?categories=8（Streaming-Film，www 会 301 到 apex，必须跟随跳转）
//   仅 confirmed：正文含 "neither announced nor confirmed" 或 "According to our sources"+"expected" 即 rumor，排除。
//   排除：纪录片（标题/正文 documentary）、剧集（title 含 series / season）、
//         合集/预告/周报（New Release Tuesday / What's Streaming This Week / Weekly Tracking / Preview / Trailer）。
//   单片确认帖标题形如 "X Sets ... Streaming Release/Premiere Date" / "X Gets ..." / "... Confirms PVOD Date for X"。
//   分页请求间隔 >= 1.2s；平台映射到 src/types/index.ts 的 StreamingPlatform 枚举，无对应值用 other。
//   去重键：platform + date + announced；同片同源已入库即跳过，同片新平台/新日期标 update-existing。
//   手工行与脚本行的区分：复用 streaming.source 字段——脚本入库的行 source 必须是
//   whentostream.com 链接（validate-data.mjs 的 M-N8 检查会校验，不另加字段）。
// 用法（在仓库根目录）：node scripts/fetch_wts.mjs [--out wts-candidates.json] [--pages 3] [--days 10]
//   --repo / --out 可覆盖默认值；--out 默认写仓库根目录 wts-candidates.json（已进 .gitignore，不提交）。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] ?? "true"] : [])).filter(Boolean)
);
const REPO = args.repo || process.env.WTS_REPO || REPO_ROOT;
const OUT = args.out || join(REPO_ROOT, "wts-candidates.json");
const MAX_PAGES = parseInt(args.pages || "3", 10);
const DAYS = parseInt(args.days || "10", 10);
const PER_PAGE = 20;
const BASE = "https://whentostream.com/wp-json/wp/v2/posts";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#8217;/g, "'").replace(/&#8211;/g, "-").replace(/\s+/g, " ").trim();

const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
const PLATFORM_WORDS = [
  ["netflix", "netflix"], ["hulu", "hulu"], ["hbo max", "max"], ["max", "max"],
  ["apple tv", "apple-tv"], ["itunes", "apple-tv"], ["prime video", "prime"], ["amazon prime", "prime"],
  ["disney+", "disney-plus"], ["disney plus", "disney-plus"], ["mubi", "mubi"],
  ["peacock", "other"], ["paramount+", "other"], ["amc+", "other"], ["shudder", "other"], ["tubi", "other"],
];
const CATALOG_FILES = ["films.json", "major-awards.json", "more-catalog.json", "extra-catalog.json", "density-pack.json", "wts-streaming-catalog.json", "won-streaming-catalog.json", "motn-streaming-catalog.json", "movie-peek-catalog.json"];

function loadExisting(repo) {
  const keys = new Set(), sources = new Set(), ids = new Set(), titles = new Map();
  for (const f of CATALOG_FILES) {
    const p = join(repo, "src/data", f);
    if (!existsSync(p)) continue;
    try {
      const data = JSON.parse(readFileSync(p, "utf8"));
      const films = Array.isArray(data) ? data : data.films || [];
      for (const film of films) {
        ids.add(film.id);
        if (film.titleEn) titles.set(film.titleEn.toLowerCase(), film.id);
        for (const s of film.streaming || []) {
          if (s.status === "announced" && s.date) keys.add(`${film.id}|${s.platform}|${s.date}|announced`);
          if (s.source) sources.add(s.source);
        }
      }
    } catch (e) { console.error("WARN parse", f, e.message); }
  }
  return { keys, sources, ids, titles };
}

function toTitleCase(s) {
  const small = new Set(["and", "of", "the", "a", "an", "in", "on", "for", "with"]);
  return s.toLowerCase().split(/[\s-]+/).map((w, i) => {
    if (!w) return w;
    if (i > 0 && small.has(w)) return w;
    if (/^[A-Z0-9]+$/.test(w) && w.length <= 4 && /[A-Z]/.test(w)) return w; // 保留缩写形态由 agent 复核
    return w[0].toUpperCase() + w.slice(1);
  }).join(" ");
}

function extractTitleEn(rawTitle) {
  let t = rawTitle.trim();
  // "Universal Confirms PVOD Date for X, Sets ..." -> X
  let m = t.match(/confirms?\s+(?:pvod|vod|digital|streaming)[^,]*?\s+for\s+(.+?)(?:,|\s+sets\s+|\s+and\s+sets\s*$|$)/i);
  if (m) return toTitleCase(m[1].trim());
  // "X Sets/Gets ..." -> X
  m = t.match(/^(.+?)\s+(?:sets?|gets?|announces?|reveals?|unveils?)\s+/i);
  if (m) t = m[1];
  // 去掉前置描述词：Aaron Sorkin's / Cristian Mungiu's Palme d'Or Winner / Acclaimed Documentary / Action Thriller 等
  t = t.replace(/^([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,2})'s\s+/i, "");
  t = t.replace(/^(acclaimed|award-winning)\s+/i, "");
  t = t.replace(/^(action|horror|comedy|spider horror|romantic comedy|sci-fi|indie drama|biblical drama)\s+(thriller|comedy|drama|horror)?\s*/i, "");
  t = t.replace(/^.*?palme d'or winner\s+/i, "");
  return toTitleCase(t.trim());
}

function extractDate(text) {
  const m = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${String(MONTHS[m[1]]).padStart(2, "0")}-${String(parseInt(m[2], 10)).padStart(2, "0")}`;
}

function extractDirector(text) {
  const m = text.match(/directed by\s+([A-Z][A-Za-z'’. -]+?)(?:\s+and written|\s+written|\.|,|;)/);
  return m ? m[1].trim() : "";
}

function extractPlatform(rawTitle, text) {
  const hay = `${rawTitle} ${text.slice(0, 600)}`.toLowerCase();
  for (const [word, platform] of PLATFORM_WORDS) {
    if (hay.includes(word)) return platform;
  }
  return "other";
}

function classify(post) {
  const rawTitle = strip(post.title.rendered);
  const text = strip(post.content.rendered);
  const lowTitle = rawTitle.toLowerCase();
  if (/new release tuesday|what'?s streaming this week|weekly tracking|preview|trailer|poster|what'?s (new|coming)|here'?s what'?s streaming/i.test(rawTitle)) {
    return { skip: "roundup" };
  }
  if (/documentary/i.test(rawTitle) || /\bdocumentary\b/i.test(text.slice(0, 400))) {
    return { skip: "documentary" };
  }
  if (/\bseries\b/i.test(rawTitle) || /season\s+\d/i.test(rawTitle) || /limited series/i.test(text.slice(0, 300))) {
    return { skip: "series" };
  }
  const rumor = /neither announced nor confirmed/i.test(text) || (/according to our sources/i.test(text) && /expected to/i.test(text));
  if (rumor) return { skip: "rumor" };
  if (!/(sets?|gets?|confirms?|announces?)\b/i.test(rawTitle)) return { skip: "not-single-film-date" };
  if (!/(streaming|pvod|vod|digital)/i.test(rawTitle)) return { skip: "not-single-film-date" };
  const date = extractDate(text);
  if (!date) return { skip: "no-date" };
  const titleEn = extractTitleEn(rawTitle);
  const yearM = text.match(/launched in (?:US |U\.S\. )?theaters on [A-Z][a-z]+ \d{1,2}(?:st|nd|rd|th)?, (\d{4})/);
  const year = yearM ? parseInt(yearM[1], 10) : parseInt(date.slice(0, 4), 10);
  const slug = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return {
    candidate: {
      postId: post.id, postDate: post.date, rawTitle, titleEn, slug, year,
      director: extractDirector(text),
      platform: extractPlatform(rawTitle, text),
      date, status: "announced", region: "美国",
      source: post.link,
      snippet: text.slice(0, 220),
    },
  };
}

async function main() {
  const existing = REPO ? loadExisting(REPO) : { keys: new Set(), sources: new Set(), ids: new Set(), titles: new Map() };
  const cutoff = Date.now() - DAYS * 86400 * 1000;
  const candidates = [];
  const skipped = { rumor: [], documentary: [], series: [], roundup: [], duplicate: [], "no-date": [], "not-single-film-date": [] };
  let fetched = 0, stopEarly = false;
  for (let page = 1; page <= MAX_PAGES && !stopEarly; page++) {
    if (page > 1) await sleep(1200);
    const url = `${BASE}?categories=8&per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc&_fields=id,date,title,link,content`;
    const res = await fetch(url, { headers: { "User-Agent": "ReadCine-news-ingest/1.0 (+https://news.readcine.com)" } });
    if (!res.ok) throw new Error(`WTS HTTP ${res.status} page ${page}`);
    const posts = await res.json();
    if (!posts.length) break;
    fetched += posts.length;
    for (const post of posts) {
      if (new Date(post.date).getTime() < cutoff) { stopEarly = true; break; }
      const r = classify(post);
      if (r.skip) { skipped[r.skip].push({ id: post.id, date: post.date.slice(0, 10), title: strip(post.title.rendered) }); continue; }
      const c = r.candidate;
      if (existing.sources.has(c.source)) {
        skipped.duplicate.push({ id: post.id, date: post.date.slice(0, 10), title: c.rawTitle, key: "same-source" });
        continue;
      }
      const filmId = existing.ids.has(c.slug) ? c.slug : existing.titles.get(c.titleEn.toLowerCase());
      if (filmId) {
        if (existing.keys.has(`${filmId}|${c.platform}|${c.date}|announced`)) {
          skipped.duplicate.push({ id: post.id, date: post.date.slice(0, 10), title: c.rawTitle, key: `${filmId}|${c.platform}|${c.date}|announced` });
          continue;
        }
        c.status = "update-existing";
        c.existingFilmId = filmId;
      }
      candidates.push(c);
    }
  }
  const out = { generated_at: new Date().toISOString(), source: "whentostream.com categories=8", fetched, candidates, skipped };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`fetched=${fetched} candidates=${candidates.length} ` + Object.entries(skipped).map(([k, v]) => `${k}=${v.length}`).join(" "));
  for (const c of candidates) console.log(` - [${c.status}] ${c.titleEn} | ${c.platform} | ${c.date} | ${c.source}`);
}

main().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
