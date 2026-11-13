#!/usr/bin/env node
// fill-douban-ratings.mjs — build-time Douban rating filler.
//
// 运行顺序（与 translate-new 一样，在采入之后、构建之前单独跑，不进 prebuild）：
//   采入（fetch_whatson_netflix.py / fetch_motn_upcoming.py /
//         ingest_movie_peek_resources.py / build-film-copy.mjs）
//     → node scripts/translate-new.mjs
//     → node scripts/fill-douban-ratings.mjs    （或 npm run fill-douban）
//     → npm run build
//
// translate-new 在仓库里没有 package.json script、也没有 cron 条目，只在脚本头
// 说明由人在构建前执行。本脚本照这个接法，并额外提供 `npm run fill-douban`。
// 网络请求不放进 prebuild，避免拖慢或阻断 `npm run build`。
//
// 规则：只补缺失的 doubanRating，已有非空值一律跳过。Peek 片 id
// （movie-douban-<subjectId>）直接查详情。其他片用片名 + 年份搜索。
// 豆瓣年份与数据 year 相差不超过 1 年才写。差 2 年及以上不写。
// 豆瓣超时、空响应、HTTP 非 200 只记一行日志然后跳过。脚本始终以 0 退出。
//
// 接口照 ECS /opt/movieupdate/douban.py 的已验证调用（移动端 UA、suggest、
// subject_search 回退、rexxar 详情、限流与详情重试）。只把分数写入影片所属的
// catalog：Peek → movie-peek-catalog.json，其余写入该片 id 所在的文件。
//
// Usage:
//   node scripts/fill-douban-ratings.mjs
//   node scripts/fill-douban-ratings.mjs --dry-run
//   node scripts/fill-douban-ratings.mjs --limit 10
//   node scripts/fill-douban-ratings.mjs --limit=10 --dry-run
//
// --limit N 最多处理 N 部尚无评分的影片。N 为偶数时 Peek 直查和片名搜索各半
// （--limit 10 即 5 + 5），用来先核对两条路径。不带 --limit 时按 catalog 顺序处理全部。
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const CACHE_PATH = join(ROOT, "scripts", "cache", "douban-ratings.json");

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1";

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

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "film", "part", "des", "les", "une", "das", "der", "und",
]);

function parseArgs(argv) {
  let dryRun = false;
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--limit" && /^\d+$/.test(argv[i + 1] || "")) {
      limit = Number(argv[++i]);
    } else if (/^--limit=\d+$/.test(arg)) {
      limit = Number(arg.slice("--limit=".length));
    } else {
      console.error(`fill-douban skip flag unrecognized ${arg}`);
    }
  }
  return { dryRun, limit };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter() {
  return 800 + Math.floor(Math.random() * 701);
}

let paced = false;
let extraDelay = 0;
async function pace() {
  const delay = extraDelay;
  extraDelay = 0;
  if (paced) await sleep(jitter() + delay);
  paced = true;
}

function rateLimited(message) {
  return Boolean(message && /太频繁|429/.test(String(message)));
}

function noteRateLimit(message) {
  // 搜索接口比详情更容易封。命中「太频繁」后把下一次搜索推迟，避免整批都被跳过。
  if (rateLimited(message)) extraDelay = 45000;
}

let lastSearchAt = 0;
/** 搜索（suggest 与 subject_search）彼此间隔 2.4 秒以上。限流后退避约 45 秒。 */
async function searchGap() {
  const minGap = 2400 + Math.floor(Math.random() * 700);
  const need = Math.max(minGap, extraDelay);
  const backoff = extraDelay;
  extraDelay = 0;
  if (lastSearchAt) {
    const since = Date.now() - lastSearchAt;
    if (since < need) await sleep(need - since);
  } else if (backoff > 0) {
    await sleep(backoff);
  }
  lastSearchAt = Date.now();
}

function clean(value) {
  return String(value || "")
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .trim();
}

function cjkFragments(value) {
  return [...clean(value).matchAll(/[\u4e00-\u9fff]+/g)].map((match) => match[0]);
}

function enWords(value) {
  return [
    ...new Set(
      [...clean(value).matchAll(/[A-Za-z][A-Za-z0-9'’-]*/g)]
        .map((match) => match[0].toLowerCase())
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
    ),
  ];
}

function parseYear(value) {
  if (value == null || value === "") return null;
  const match = String(value).match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  if (year < 1888 || year > 2100) return null;
  return year;
}

function yearFromItem(item) {
  const direct = parseYear(item && item.year);
  if (direct && String(item.year).trim() === String(direct)) return direct;
  const matches = [...clean(item && item.title).matchAll(/\((\d{4})\)/g)];
  if (!matches.length) return direct;
  return Number(matches[matches.length - 1][1]);
}

function titleMatchScore(film, doubanTitle, original) {
  const blob = `${clean(doubanTitle)} ${clean(original)}`;
  const blobLower = blob.toLowerCase();
  let score = 0;
  const fragments = [...new Set([...cjkFragments(film.title), ...cjkFragments(film.titleEn)])];
  for (const fragment of fragments) {
    if (fragment && blob.includes(fragment)) score += fragment.length;
  }
  for (const word of [...new Set([...enWords(film.title), ...enWords(film.titleEn)])]) {
    if (blobLower.includes(word)) score += Math.min(word.length, 12);
  }
  return score;
}

/** 中文名里夹着的拉丁词和数字必须一起命中，不能只靠截出来的汉字。 */
function titleExtrasOk(title, blob) {
  const latinOk = enWords(title).every((word) => blob.toLowerCase().includes(word));
  const digitsOk = [...clean(title).matchAll(/\d+/g)].every((match) => hasNum(blob, match[0]));
  return latinOk && digitsOk;
}

/** 标题高度匹配：中文整词命中，或英文名与豆瓣片名/原名整段相同。 */
function highTitleMatch(film, doubanTitle, original) {
  if (numbersClash(film, doubanTitle, original)) return false;
  const blob = `${clean(doubanTitle)} ${clean(original)}`;
  const han = cjkFragments(film.title);
  const long = han.filter((fragment) => fragment.length >= 4);
  if (long.length && long.every((fragment) => chineseBounded(fragment, doubanTitle, original)) && titleExtrasOk(film.title, blob)) return true;
  const tokens = cjkFragments(doubanTitle);
  const short = han.filter((fragment) => fragment.length >= 2 && fragment.length < 4);
  if (short.length && short.every((fragment) => tokens.some((token) => token === fragment)) && titleExtrasOk(film.title, blob)) {
    return true;
  }
  if (han.length === 1 && han[0].length === 1 && titleExtrasOk(film.title, blob)) {
    const tokens = cjkFragments(doubanTitle);
    if (tokens.some((token) => token === han[0])) return true;
  }
  for (const part of `${clean(film.titleEn)} ${clean(film.title)}`.split(/[/／|]/)) {
    if (englishPartOk(part, doubanTitle, original)) return true;
  }
  return false;
}

function stripYearSuffix(value) {
  return clean(value).replace(/\s*[（(]\d{4}[)）]\s*$/, "").trim().toLowerCase();
}

/** 英文只认与豆瓣片名或原名整段相同（可去掉末尾年份）。长标题里的人名片段不算。 */
function englishPartOk(part, doubanTitle, original) {
  const piece = stripYearSuffix(part);
  if (piece.length < 4) return false;
  return [doubanTitle, original].some((value) => stripYearSuffix(value) === piece);
}

/** 中文片段必须落在词的边界上，不能从更长词的中段切出来。 */
function boundedIncludes(haystack, needle) {
  const text = clean(haystack);
  const piece = clean(needle);
  if (!piece || piece.length < 4) return false;
  let from = 0;
  while (from <= text.length - piece.length) {
    const at = text.indexOf(piece, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : text[at - 1];
    const after = at + piece.length >= text.length ? "" : text[at + piece.length];
    const cjk = (char) => /[\u4e00-\u9fff]/.test(char || "");
    if (!cjk(before) && !cjk(after)) return true;
    from = at + 1;
  }
  return false;
}

function chineseBounded(fragment, doubanTitle, original) {
  return boundedIncludes(doubanTitle, fragment) || boundedIncludes(original, fragment);
}

function hasNum(blob, num) {
  return new RegExp(`(?:^|\\D)${num}(?:\\D|$)`).test(blob);
}

function editionNums(value) {
  const text = clean(value);
  const nums = [];
  for (const match of text.matchAll(/第\s*(\d+)\s*届/g)) nums.push(match[1]);
  for (const match of text.matchAll(/(?:^|[^\d])(\d+)\s*(?:st|nd|rd|th)\b/gi)) nums.push(match[1]);
  return [...new Set(nums)];
}

/** 中文片名里的数字必须出现在豆瓣标题里（巴勒斯坦36）。两边都写了届次时，届次必须相同。 */
function numbersClash(film, doubanTitle, original) {
  const blob = `${clean(doubanTitle)} ${clean(original)}`;
  const titleNums = [...clean(film.title).matchAll(/\d+/g)].map((match) => match[0]);
  if (titleNums.some((num) => !hasNum(blob, num))) return true;
  const siteEd = editionNums(`${clean(film.title)} ${clean(film.titleEn)}`);
  if (!siteEd.length) return false;
  const blobEd = editionNums(blob);
  if (blobEd.length) {
    return siteEd.some((num) => !blobEd.includes(num)) || blobEd.some((num) => !siteEd.includes(num));
  }
  return siteEd.some((num) => !hasNum(blob, num));
}

function titleAcceptable(film, doubanTitle, original) {
  const blob = `${clean(doubanTitle)} ${clean(original)}`;
  const title = clean(film.title);
  const titleEn = clean(film.titleEn);
  // 第99届不能配第98届。
  if (numbersClash(film, doubanTitle, original)) return false;
  // 较长片名必须落在词边界上（疗愈之地，飞鸟栖止 的逗号算边界）。
  // 「平凡之路」嵌在「平凡者的不平凡之路」里不算。
  if (chineseBounded(title, doubanTitle, original)) return true;
  if (title.length >= 2 && title.length < 4 && cjkFragments(doubanTitle).some((token) => token === title)) {
    return true;
  }
  if (englishPartOk(titleEn, doubanTitle, original)) return true;
  for (const part of titleEn.split(/[/／|]/)) {
    if (englishPartOk(part, doubanTitle, original)) return true;
  }
  const han = cjkFragments(film.title);
  if (titleMatchScore(film, doubanTitle, original) <= 0) return false;
  // 两三个字只认完整词，避免「再见」命中「三声再见」。片名里的 UFO / 数字也要在。
  if (han.some((fragment) => fragment.length >= 4 && chineseBounded(fragment, doubanTitle, original)) && titleExtrasOk(title, blob)) {
    return true;
  }
  if (
    han.some((fragment) => fragment.length >= 2 && fragment.length < 4 && cjkFragments(doubanTitle).some((token) => token === fragment))
    && titleExtrasOk(title, blob)
  ) {
    return true;
  }
  if (han.length === 1 && han[0].length === 1 && cjkFragments(doubanTitle).some((token) => token === han[0])) {
    return true;
  }
  return highTitleMatch(film, doubanTitle, original);
}

function searchQuery(film) {
  const title = clean(film.title);
  const titleEn = clean(film.titleEn);
  // 数字和拉丁字母是片名的一部分。丢掉它们会搜到别的片子（再见 UFO、第99届奥斯卡）。
  if (title && (/\d/.test(title) || /[A-Za-z]/.test(title))) return title;
  if (title && /[\u3040-\u30ff]/.test(title)) return title;
  const han = cjkFragments(title);
  if (han.length === 1 && han[0].length === 1) return han[0];
  if (han.length && title.length >= 2) return title;
  if (titleEn && titleEn.toLowerCase() !== title.toLowerCase()) return titleEn;
  return title || titleEn;
}

function altQuery(film, primary) {
  const title = clean(film.title);
  const titleEn = clean(film.titleEn);
  for (const candidate of [titleEn, title]) {
    if (!candidate) continue;
    if (candidate.toLowerCase() === primary.toLowerCase()) continue;
    if (candidate.length < 2) continue;
    return candidate;
  }
  return null;
}

/** 数据年份与豆瓣年份相差不超过 1 年。缺少年份，或差 2 年及以上，都不算对得上。 */
function yearsCompatible(filmYear, doubanYear) {
  if (!filmYear || !doubanYear) return false;
  return Math.abs(filmYear - doubanYear) <= 1;
}

function peekDoubanId(id) {
  const match = String(id || "").match(/^movie-douban-(\d+)$/);
  return match ? match[1] : null;
}

function hasRating(film) {
  const rating = film && film.doubanRating;
  if (rating == null || rating === "") return false;
  if (typeof rating === "object") return Object.keys(rating).length > 0;
  return true;
}

function isNonFeature(film) {
  const genres = (film.genres || []).join("|");
  const title = film.title || "";
  return /荣誉|评审/.test(genres) || /荣誉|评审/.test(title);
}

function cacheKey(film) {
  return `${film.title}|${film.year}`;
}

function loadCache() {
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data;
  } catch (err) {
    if (err && err.code === "ENOENT") return {};
    console.error(`fill-douban cache unreadable, starting empty (${err.message})`);
    return {};
  }
}

function saveCache(cache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(cache).sort().map((key) => [key, cache[key]]));
  const tmp = `${CACHE_PATH}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(sorted, null, 2)}\n`);
  renameSync(tmp, CACHE_PATH);
}

async function fetchText(url, { referer, timeout }) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: referer,
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text || !text.trim()) throw new Error("empty response");
  return text;
}

function extractData(html) {
  const start = html.indexOf("window.__DATA__");
  if (start < 0) return null;
  const eq = html.indexOf("=", start);
  if (eq < 0) return null;
  let index = eq + 1;
  while (html[index] === " " || html[index] === "\n") index++;
  if (html[index] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let cursor = index; cursor < html.length; cursor++) {
    const char = html[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(index, cursor + 1));
    }
  }
  return null;
}

function normalizeDetail(doubanId, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("detail not an object");
  }
  if (!data.title && !data.id && !data.rating) throw new Error("detail missing title");
  const scoreRaw = data.rating ? data.rating.value : undefined;
  const countRaw = data.rating ? data.rating.count : undefined;
  const score = typeof scoreRaw === "number" ? scoreRaw : Number(scoreRaw);
  const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
  const rated = Number.isFinite(score) && score > 0;
  return {
    kind: "detail",
    fetchedAt: new Date().toISOString(),
    status: rated ? "rated" : "no_score",
    doubanId: String(data.id || doubanId),
    title: clean(data.title),
    originalTitle: clean(data.original_title),
    year: data.year != null ? String(data.year) : "",
    score: rated ? score : 0,
    count: Number.isFinite(count) && count > 0 ? Math.round(count) : 0,
  };
}

async function loadDetail(doubanId, cache, dryRun) {
  const key = String(doubanId);
  const hit = cache[key];
  if (hit && hit.kind === "detail" && (hit.status === "rated" || hit.status === "no_score")) {
    return { ...hit, fromCache: true };
  }
  const url = `https://m.douban.com/rexxar/api/v2/movie/${key}?ck=`;
  const referer = `https://m.douban.com/movie/subject/${key}/`;
  let lastError = "detail failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt === 0) await pace();
    else await sleep(attempt === 1 ? 600 : 1200);
    try {
      const text = await fetchText(url, { referer, timeout: 12000 });
      const record = normalizeDetail(key, JSON.parse(text));
      cache[key] = record;
      if (!dryRun) saveCache(cache);
      return { ...record, fromCache: false };
    } catch (err) {
      lastError = err && err.name === "TimeoutError" ? "timeout" : err.message || String(err);
    }
  }
  return { error: lastError };
}

async function suggest(query) {
  const url = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(query)}`;
  await searchGap();
  try {
    const text = await fetchText(url, { referer: "https://movie.douban.com/", timeout: 6000 });
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { network: true, error: "suggest invalid json" };
    }
    if (!Array.isArray(data)) return { network: true, error: "suggest not an array" };
    const first = data.find((item) => item && item.type === "movie" && item.id);
    if (!first) return { items: [] };
    return {
      hit: {
        id: String(first.id),
        title: clean(first.title),
        original: clean(first.sub_title),
        year: parseYear(first.year),
      },
    };
  } catch (err) {
    const reason = err && err.name === "TimeoutError" ? "timeout" : err.message || String(err);
    return { network: true, error: `suggest ${reason}` };
  }
}

async function searchMovies(query) {
  const url =
    `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(query)}&cat=1002`;
  let lastError = "search failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    await searchGap();
    try {
      const text = await fetchText(url, { referer: "https://search.douban.com/", timeout: 6000 });
      const data = extractData(text);
      if (!data) return { network: true, error: "search no __DATA__" };
      if (data.error_info) {
        const error = `search ${clean(data.error_info).slice(0, 80)}`;
        lastError = error;
        // 限流只再试一次，先退避大约 45 秒。普通超时不在这里打转。
        if (rateLimited(error) && attempt === 0) {
          extraDelay = 45000;
          continue;
        }
        noteRateLimit(error);
        return { network: true, error };
      }
      const items = Array.isArray(data.items) ? data.items.filter((item) => item && item.id) : [];
      return { items };
    } catch (err) {
      const reason = err && err.name === "TimeoutError" ? "timeout" : err.message || String(err);
      return { network: true, error: `search ${reason}` };
    }
  }
  return { network: true, error: lastError };
}

function choose(film, items) {
  const filmYear = parseYear(film.year);
  const scored = [];
  for (const item of items || []) {
    const year = yearFromItem(item);
    const titleScore = titleMatchScore(film, item.title || "", "");
    let rank = titleScore;
    if (filmYear && year) {
      const diff = Math.abs(filmYear - year);
      if (diff === 0) rank += 100;
      else if (diff <= 2) rank += 50;
    }
    scored.push({
      id: String(item.id),
      title: clean(item.title),
      year,
      titleScore,
      rank,
      titleOk: titleAcceptable(film, item.title || "", ""),
    });
  }
  if (!scored.length) return { ok: false, reason: "not_found" };

  const acceptable = scored.filter((row) => {
    if (!row.titleOk || row.rank <= 0) return false;
    if (!filmYear) return highTitleMatch(film, row.title, "");
    return yearsCompatible(filmYear, row.year);
  });
  if (acceptable.length) {
    acceptable.sort((a, b) => b.rank - a.rank);
    return { ok: true, ...acceptable[0] };
  }

  const closeYear = filmYear
    ? scored.filter((row) => yearsCompatible(filmYear, row.year))
    : [];
  if (closeYear.length) {
    closeYear.sort((a, b) => b.rank - a.rank);
    return { ok: false, reason: "title_mismatch", ...closeYear[0] };
  }
  const withYear = scored.filter((row) => row.year);
  if (filmYear && withYear.length) {
    withYear.sort((a, b) => b.rank - a.rank);
    return { ok: false, reason: "year_mismatch", ...withYear[0] };
  }
  scored.sort((a, b) => b.rank - a.rank);
  return { ok: false, reason: filmYear ? "year_mismatch" : "title_mismatch", ...scored[0] };
}

function rememberSearch(cache, film, record, dryRun) {
  cache[cacheKey(film)] = { kind: "search", fetchedAt: new Date().toISOString(), ...record };
  if (!dryRun) saveCache(cache);
}

function assessDetail(film, detail, direct) {
  const titleScore = titleMatchScore(film, detail.title, detail.originalTitle);
  const doubanYear = parseYear(detail.year);
  const filmYear = parseYear(film.year);
  const base = {
    titleScore,
    doubanTitle: detail.title,
    doubanOriginal: detail.originalTitle,
    doubanYear,
    doubanId: detail.doubanId,
    score: detail.score,
    count: detail.count,
  };
  if (detail.status !== "rated" || !(detail.score > 0)) {
    return { ...base, ok: false, reason: "no_score" };
  }
  if (!filmYear) {
    if (!highTitleMatch(film, detail.title, detail.originalTitle)) {
      return { ...base, ok: false, reason: "title_mismatch" };
    }
    return { ...base, ok: true };
  }
  if (!yearsCompatible(filmYear, doubanYear)) {
    return { ...base, ok: false, reason: "year_mismatch" };
  }
  if (!direct && !titleAcceptable(film, detail.title, detail.originalTitle)) {
    return { ...base, ok: false, reason: "title_mismatch" };
  }
  return { ...base, ok: true, weakTitle: direct && !titleAcceptable(film, detail.title, detail.originalTitle) };
}

function suggestAcceptable(film, hit) {
  const filmYear = parseYear(film.year);
  if (!filmYear) return highTitleMatch(film, hit.title, hit.original);
  // 相差超过 1 年的 suggest 不用，交给 subject_search 再挑。
  if (!yearsCompatible(filmYear, hit.year)) return false;
  return titleAcceptable(film, hit.title, hit.original);
}

function rejectedRecord(picked, query) {
  return {
    status: "rejected",
    reason: picked.reason,
    doubanId: picked.id || "",
    doubanTitle: picked.title || "",
    doubanYear: picked.year ?? null,
    query,
  };
}

function queryStillValid(film, cached) {
  const used = clean(cached && cached.query).toLowerCase();
  if (!used) return false;
  const primary = clean(searchQuery(film)).toLowerCase();
  if (used === primary) return true;
  const alt = altQuery(film, searchQuery(film));
  return Boolean(alt && used === clean(alt).toLowerCase());
}

async function resolveSearch(film, cache, dryRun) {
  const cached = cache[cacheKey(film)];
  if (cached && cached.kind === "search") {
    const queryOk = queryStillValid(film, cached);
    if (cached.status === "picked" && cached.doubanId) {
      const detail = await loadDetail(cached.doubanId, cache, dryRun);
      if (detail && !detail.error) {
        const verdict = assessDetail(film, detail, false);
        const titleOk = titleAcceptable(film, detail.title, detail.originalTitle);
        // 标题对不上（含暂无评分的错片）就重新搜。标题对上才信任缓存：
        // 有分且年份相差不超过 1 年则沿用；暂无评分，或查询仍有效的年份不符，保持跳过。
        const keep =
          titleOk &&
          (verdict.ok ||
            verdict.reason === "no_score" ||
            (verdict.reason === "year_mismatch" && queryOk));
        if (keep) {
          return { via: cached.via || "cache", query: cached.query || "", detail, fromCache: true };
        }
      } else if (detail && detail.error) {
        return { via: cached.via || "cache", query: cached.query || "", detail, fromCache: true };
      }
    } else if (queryOk) {
      // 旧的「标题不符」结论在匹配放宽后可以重判。年份仍超出 ±1 的保持跳过，不再请求搜索。
      const cachedYear = parseYear(cached.doubanYear) || parseYear(cached.doubanTitle);
      const filmYear = parseYear(film.year);
      const yearOk = !filmYear || yearsCompatible(filmYear, cachedYear);
      if (
        cached.status === "rejected" &&
        cached.doubanId &&
        yearOk &&
        titleAcceptable(film, cached.doubanTitle || "", "")
      ) {
        const detail = await loadDetail(cached.doubanId, cache, dryRun);
        return { via: "cache", query: cached.query || "", detail, fromCache: true };
      }
      return { via: "cache", query: cached.query || "", fromCache: true, rejected: cached };
    }
  }

  const query = searchQuery(film);
  if (!query) return { via: "search", query: "", rejected: { reason: "not_found" } };

  const suggested = await suggest(query);
  if (suggested.hit && suggestAcceptable(film, suggested.hit)) {
    const detail = await loadDetail(suggested.hit.id, cache, dryRun);
    if (!detail.error) {
      rememberSearch(cache, film, { status: "picked", doubanId: suggested.hit.id, via: "suggest", query }, dryRun);
    }
    return { via: "suggest", query, detail };
  }

  // suggest 为空、被反爬，或第一条电影年份/标题不符：走 subject_search。不重试 suggest 本身。
  const primary = await searchMovies(query);
  if (!primary.network) {
    let picked = choose(film, primary.items);
    let usedQuery = query;
    if (!picked.ok) {
      const alt = altQuery(film, query);
      if (alt) {
        const altResult = await searchMovies(alt);
        if (!altResult.network) {
          const altPick = choose(film, altResult.items);
          if (altPick.ok || (picked.reason === "not_found" && altPick.reason !== "not_found")) {
            picked = altPick;
            usedQuery = alt;
          }
        }
      }
    }
    if (!picked.ok) {
      rememberSearch(cache, film, rejectedRecord(picked, usedQuery), dryRun);
      return { via: "search", query: usedQuery, rejected: picked };
    }
    const detail = await loadDetail(picked.id, cache, dryRun);
    if (!detail.error) {
      rememberSearch(cache, film, { status: "picked", doubanId: picked.id, via: "search", query: usedQuery }, dryRun);
    }
    return { via: "search", query: usedQuery, detail };
  }

  // 主查询的搜索请求失败时，换片名再查一次。仍然失败就记豆瓣不通，不把失败写进缓存。
  const alt = altQuery(film, query);
  if (alt) {
    const altResult = await searchMovies(alt);
    if (!altResult.network) {
      const picked = choose(film, altResult.items);
      if (!picked.ok) {
        if (!suggested.network) {
          rememberSearch(cache, film, rejectedRecord(picked, alt), dryRun);
          return { via: "search", query: alt, rejected: picked };
        }
      } else {
        const detail = await loadDetail(picked.id, cache, dryRun);
        if (!detail.error) {
          rememberSearch(cache, film, { status: "picked", doubanId: picked.id, via: "search", query: alt }, dryRun);
        }
        return { via: "search", query: alt, detail };
      }
    }
  }

  return { via: "search", query, network: true, error: primary.error || suggested.error || "douban unreachable" };
}

function filmList(data) {
  if (Array.isArray(data)) return data.filter((item) => item && item.id && !Array.isArray(item.nominations));
  return data.films || [];
}

function selectBatch(pending, limit) {
  if (limit == null) return pending;
  const peek = pending.filter((entry) => peekDoubanId(entry.film.id));
  const rest = pending.filter((entry) => !peekDoubanId(entry.film.id));
  const peekCount = Math.min(peek.length, Math.ceil(limit / 2));
  const restCount = Math.min(rest.length, Math.max(0, limit - peekCount));
  const extraPeek = Math.min(peek.length - peekCount, Math.max(0, limit - peekCount - restCount));
  return [...peek.slice(0, peekCount + extraPeek), ...rest.slice(0, restCount)];
}

function logResult(row) {
  console.log(`fill-douban result ${JSON.stringify(row)}`);
}

function matcherSelfTest() {
  const cases = [
    [{ title: "再见 UFO", titleEn: "Goodbye UFO" }, "三声再见", "Tre Ciotole", false],
    [{ title: "第99届奥斯卡", titleEn: "99th Academy Awards" }, "第98届奥斯卡颁奖典礼", "The 98th Annual Academy Awards", false],
    [{ title: "第63届金马奖", titleEn: "63rd Golden Horse Awards" }, "第55届金马奖颁奖典礼", "", false],
    [{ title: "巴勒斯坦36", titleEn: "Palestine 36" }, "巴勒斯坦", "Palestine", false],
    [{ title: "九匹野马", titleEn: "Wild Horse Nine" }, "野马九号", "Wild Horse Nine", true],
    [{ title: "黄信", titleEn: "Yellow Letters / Gelbe Briefe" }, "告知信", "Gelbe Briefe", true],
    [{ title: "旅と日々", titleEn: "Two Seasons, Two Strangers" }, "旅途中的日子", "旅と日々", true],
    [{ title: "星期天们", titleEn: "Los domingos / Sundays" }, "礼拜天", "Los domingos", true],
    [{ title: "巴勒斯坦36", titleEn: "Palestine 36" }, "巴勒斯坦36", "فلسطين ٣٦", true],
    [{ title: "峡湾", titleEn: "Fjord" }, "峡湾", "Fjord", true],
    [{ title: "墨", titleEn: "Ink" }, "墨", "Ink", true],
    [{ title: "NAZA", titleEn: "NAZA" }, "附带伤亡", "Naza", true],
    [{ title: "实境诱捕", titleEn: "Primetime" }, "黄金时段", "Primetime", true],
    [{ title: "蓦然回首", titleEn: "Look Back" }, "蓦然回首", "ルックバック", true],
    [{ title: "奥德赛", titleEn: "The Odyssey" }, "奥德赛", "The Odyssey", true],
    [{ title: "疗愈之地", titleEn: "A Place to Heal / 15/18" }, "疗愈之地，飞鸟栖止", "On Healing Land, Birds Perch", true],
    [{ title: "可能的爱情", titleEn: "Possible Love" }, "可能的爱", "가능한 사랑", false],
    [{ title: "希望", titleEn: "Hope" }, "希望之光", "Last Hope", false],
    [{ title: "女孩", titleEn: "Girl" }, "邻家女孩", "The Girl Next Door", false],
    [{ title: "希望", titleEn: "Hope" }, "希望", "Hope", true],
    [{ title: "懦夫", titleEn: "Coward" }, "懦夫", "Coward", true],
    [{ title: "平凡之路", titleEn: "To Be Ordinary" }, "平凡者的不平凡之路", "", false],
    [{ title: "阳光女子合唱团", titleEn: "Sunshine Women's Choir" }, "阳光女子合唱团", "", true],
    [{ title: "疗愈之地", titleEn: "A Place to Heal / 15/18" }, "疗愈之地，飞鸟栖止", "On Healing Land, Birds Perch", true],
    [{ title: "阿方索·卡隆", titleEn: "Alfonso Cuarón" }, "未定名阿方索·卡隆恐怖片计划", "Untitled Alfonso Cuarón Horror Project", false],
    [{ title: "乔的一日：费德拉章", titleEn: "Jo's Day: Phaedra" }, "唐顿庄园3", "Downton Abbey 3", false],
    [{ title: "可能的爱情", titleEn: "Possible Love" }, "可能的爱", "", false],
    [{ title: "黑，红，黄", titleEn: "Kara Kyzyl Sary" }, "黑，红，黄", "Kara Kyzyl Sary", true],
    [{ title: "我爱的人", titleEn: "The Man I Love" }, "我爱的男人", "The Man I Love", true],
  ];
  const failures = [];
  for (const [film, title, original, expect] of cases) {
    const got = titleAcceptable(film, title, original);
    if (got !== expect) failures.push(`${film.title} => ${title} got ${got} expected ${expect}`);
  }
  const oscarQuery = searchQuery({ title: "第99届奥斯卡", titleEn: "99th Academy Awards" });
  if (!oscarQuery.includes("99")) failures.push(`query oscars ${oscarQuery}`);
  const ufoQuery = searchQuery({ title: "再见 UFO", titleEn: "Goodbye UFO" });
  if (!/ufo/i.test(ufoQuery)) failures.push(`query ufo ${ufoQuery}`);
  const horseQuery = searchQuery({ title: "第63届金马奖", titleEn: "63rd Golden Horse Awards" });
  if (!horseQuery.includes("63")) failures.push(`query horse ${horseQuery}`);
  if (!yearsCompatible(2026, 2026)) failures.push("same year");
  if (!yearsCompatible(2026, 2025)) failures.push("year minus 1");
  if (!yearsCompatible(2025, 2026)) failures.push("year plus 1");
  if (yearsCompatible(2026, 2024)) failures.push("year diff 2");
  if (yearsCompatible(2026, null)) failures.push("year missing");
  if (failures.length) {
    for (const line of failures) console.error(`fill-douban self-test fail ${line}`);
    process.exit(1);
  }
  console.log(`fill-douban self-test ok ${cases.length}`);
}

const PID_PATH = "/tmp/fill-douban-run.pid";

function claimSingleRun() {
  let existing = "";
  try {
    existing = readFileSync(PID_PATH, "utf8").trim();
  } catch {
    existing = "";
  }
  if (existing && existing !== String(process.pid)) {
    try {
      process.kill(Number(existing), 0);
      console.error(`fill-douban already running pid ${existing}`);
      process.exit(0);
    } catch {
      // 上次进程已退出，旧 pid 文件可以覆盖。
    }
  }
  writeFileSync(PID_PATH, `${process.pid}\n`);
}

async function main() {
  if (process.argv.includes("--self-test")) {
    matcherSelfTest();
    return;
  }
  claimSingleRun();
  const { dryRun, limit } = parseArgs(process.argv.slice(2));
  const cache = loadCache();
  const catalogs = CATALOG_FILES.map((name) => ({
    name,
    data: JSON.parse(readFileSync(join(DATA, name), "utf8")),
    dirty: false,
  }));
  const byFile = new Map(catalogs.map((catalog) => [catalog.name, catalog]));
  const flushDirty = () => {
    if (dryRun) return;
    for (const catalog of catalogs) {
      if (!catalog.dirty) continue;
      const target = join(DATA, catalog.name);
      const tmp = `${target}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(catalog.data, null, 2)}\n`);
      renameSync(tmp, target);
      catalog.dirty = false;
      console.log(`fill-douban wrote ${catalog.name}`);
    }
  };
  process.once("SIGTERM", () => {
    try {
      flushDirty();
    } catch (err) {
      console.error(`fill-douban flush failed: ${err && err.message ? err.message : err}`);
    }
    process.exit(143);
  });

  const stats = {
    scanned: 0,
    existing: 0,
    notFilm: 0,
    batch: 0,
    filled: 0,
    noScore: 0,
    yearMismatch: 0,
    titleMismatch: 0,
    notFound: 0,
    network: 0,
    error: 0,
  };
  const networkNotes = [];

  const pending = [];
  for (const catalog of catalogs) {
    for (const film of filmList(catalog.data)) {
      stats.scanned++;
      if (hasRating(film)) {
        stats.existing++;
        continue;
      }
      if (isNonFeature(film)) {
        stats.notFilm++;
        continue;
      }
      pending.push({ file: catalog.name, film });
    }
  }

  const batch = selectBatch(pending, limit);
  stats.batch = batch.length;
  console.log(
    `fill-douban: scan ${stats.scanned}, pending ${pending.length}, batch ${batch.length}` +
      `${limit != null ? ` (limit ${limit}, peek+search split)` : ""}` +
      `${dryRun ? " [dry-run]" : ""}`,
  );

  for (let index = 0; index < batch.length; index++) {
    const { file, film } = batch[index];
    const row = {
      id: film.id,
      file,
      siteTitle: film.title,
      siteTitleEn: film.titleEn || "",
      siteYear: film.year,
      action: "skip",
      reason: "",
      via: peekDoubanId(film.id) ? "peek-id" : "search",
      doubanId: "",
      doubanTitle: "",
      doubanOriginal: "",
      doubanYear: null,
      score: null,
      count: null,
      titleScore: null,
      weakTitle: false,
      query: "",
    };
    try {
      if (hasRating(film)) {
        row.reason = "existing";
        stats.existing++;
        logResult(row);
        continue;
      }

      let detail = null;
      let direct = false;
      const embedded = peekDoubanId(film.id);
      if (embedded) {
        direct = true;
        row.via = "peek-id";
        row.query = embedded;
        detail = await loadDetail(embedded, cache, dryRun);
      } else {
        const resolved = await resolveSearch(film, cache, dryRun);
        row.via = resolved.via || "search";
        row.query = resolved.query || "";
        if (resolved.network) {
          row.reason = "network";
          row.error = resolved.error || "douban unreachable";
          stats.network++;
          networkNotes.push(`${film.id} ${row.error}`);
          console.error(`fill-douban skip ${film.id} network ${row.error}`);
          logResult(row);
          if (/太频繁|429/.test(row.error || "")) await sleep(30000);
          continue;
        }
        if (resolved.rejected) {
          row.reason = resolved.rejected.reason || "not_found";
          row.doubanId = resolved.rejected.doubanId || resolved.rejected.id || "";
          row.doubanTitle = resolved.rejected.doubanTitle || resolved.rejected.title || "";
          row.doubanYear = resolved.rejected.doubanYear || resolved.rejected.year || null;
          if (row.reason === "no_score") stats.noScore++;
          else if (row.reason === "year_mismatch") stats.yearMismatch++;
          else if (row.reason === "title_mismatch") stats.titleMismatch++;
          else {
            row.reason = "not_found";
            stats.notFound++;
          }
          console.error(`fill-douban skip ${film.id} ${row.reason}`);
          logResult(row);
          continue;
        }
        detail = resolved.detail;
      }

      if (!detail || detail.error) {
        row.reason = "network";
        row.error = (detail && detail.error) || "douban unreachable";
        stats.network++;
        networkNotes.push(`${film.id} ${row.error}`);
        console.error(`fill-douban skip ${film.id} network ${row.error}`);
        logResult(row);
        if (/太频繁|429/.test(row.error || "")) await sleep(30000);
        continue;
      }

      const verdict = assessDetail(film, detail, direct);
      row.doubanId = verdict.doubanId || "";
      row.doubanTitle = verdict.doubanTitle || "";
      row.doubanOriginal = verdict.doubanOriginal || "";
      row.doubanYear = verdict.doubanYear;
      row.score = verdict.score;
      row.count = verdict.count;
      row.titleScore = verdict.titleScore;
      row.weakTitle = Boolean(verdict.weakTitle);
      if (!verdict.ok) {
        row.reason = verdict.reason;
        if (verdict.reason === "no_score") stats.noScore++;
        else if (verdict.reason === "year_mismatch") stats.yearMismatch++;
        else if (verdict.reason === "title_mismatch") stats.titleMismatch++;
        else stats.notFound++;
        console.error(`fill-douban skip ${film.id} ${row.reason}`);
        logResult(row);
        continue;
      }

      row.action = dryRun ? "would_write" : "write";
      row.reason = "";
      stats.filled++;
      if (!dryRun) {
        film.doubanRating = {
          score: verdict.score,
          count: verdict.count,
          doubanId: String(verdict.doubanId),
          updatedAt: detail.fetchedAt || new Date().toISOString(),
        };
        byFile.get(file).dirty = true;
      }
      console.log(
        `fill-douban ${dryRun ? "WOULD" : "WRITE"} ${film.id} ${verdict.score} ← ${verdict.doubanTitle} ${verdict.doubanYear || ""} (${verdict.doubanId})`,
      );
      logResult(row);
    } catch (err) {
      row.reason = "error";
      row.error = err.message || String(err);
      stats.error++;
      networkNotes.push(`${film.id} ${row.error}`);
      console.error(`fill-douban skip ${film.id} error ${row.error}`);
      logResult(row);
    }
    if ((index + 1) % 25 === 0) {
      console.log(`fill-douban progress ${index + 1}/${batch.length} filled ${stats.filled}`);
      flushDirty();
    }
  }

  flushDirty();

  const summary = {
    dryRun,
    limit,
    scanned: stats.scanned,
    filled: stats.filled,
    skippedExisting: stats.existing,
    skippedNotFilm: stats.notFilm,
    skippedNoScore: stats.noScore,
    skippedYearMismatch: stats.yearMismatch,
    skippedTitleMismatch: stats.titleMismatch,
    skippedNotFound: stats.notFound,
    skippedNetwork: stats.network,
    skippedError: stats.error,
    batch: stats.batch,
    notInBatch: Math.max(0, pending.length - batch.length),
    networkNotes,
  };
  console.log(`fill-douban summary ${JSON.stringify(summary)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`fill-douban failed: ${err && err.stack ? err.stack : err}`);
    process.exit(0);
  });
