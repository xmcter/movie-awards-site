/** A.1 regression: dismiss "similar" must not cross-hide other films.
 * Uses the real implementation (src/lib/dismiss.ts) against the real
 * zh/en timelines (src/lib/data.ts), and compares against the old
 * Dice-everywhere rule to show the before/after mis-hide counts.
 * Run: node scripts/test-dismiss-regression.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args);
};
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { getTimelineEvents } = require("../src/lib/data.ts");
const dismiss = require("../src/lib/dismiss.ts");
const { isSimilarMark, strippedTitleKey } = dismiss;

// ---- Old rule (pre-2026-11-13 fix): Dice across films -------------------
function normalizeForDice(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}
function extractBigrams(str) {
  const clean = normalizeForDice(str);
  const set = new Set();
  if (clean.length === 0) return set;
  if (clean.length === 1) { set.add(clean); return set; }
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}
function diceCoefficient(a, b) {
  const na = normalizeForDice(a);
  const nb = normalizeForDice(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    if (ratio >= 0.7) return Math.max(0.7, ratio);
  }
  const setA = extractBigrams(na);
  const setB = extractBigrams(nb);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const bg of setA) if (setB.has(bg)) intersection++;
  return (2 * intersection) / (setA.size + setB.size);
}
function oldIsSimilarMark(event, mark) {
  if (!event || !mark) return false;
  if (event.filmId && mark.filmId && event.filmId === mark.filmId) return true;
  const eventTitle = event.headline || event.filmTitle || "";
  const markTitle = mark.headline || "";
  const titleDice = diceCoefficient(eventTitle, markTitle);
  if (event.type === mark.type && titleDice >= 0.45) return true;
  if (titleDice >= 0.55) return true;
  const eventSummary = event.summary || "";
  const markSummary = mark.summary || "";
  if (eventSummary && markSummary) {
    if (diceCoefficient(eventSummary, markSummary) >= 0.55) return true;
    if (diceCoefficient(eventTitle, markSummary) >= 0.55 || diceCoefficient(eventSummary, markTitle) >= 0.55) return true;
  }
  return false;
}

// ---- Measure --------------------------------------------------------------
function markFrom(event) {
  return {
    at: 0,
    type: event.type,
    filmId: event.filmId,
    headline: event.headline || event.filmTitle,
    summary: event.summary,
  };
}

function crossFilmPairs(events, similarFn) {
  const pairs = [];
  for (const e of events) {
    const mark = markFrom(e);
    for (const f of events) {
      if (f.id === e.id) continue;
      if (f.filmId === e.filmId) continue;
      if (similarFn(f, mark)) pairs.push([e, f]);
    }
  }
  return pairs;
}

function hiddenOthers(events, target, similarFn) {
  const mark = markFrom(target);
  return events.filter((f) => f.id !== target.id && f.filmId !== target.filmId && similarFn(f, mark));
}

for (const locale of ["zh", "en"]) {
  const events = getTimelineEvents(locale);
  assert.ok(events.length > 0, `${locale}: timeline must not be empty`);
  const oldPairs = crossFilmPairs(events, oldIsSimilarMark);
  const newPairs = crossFilmPairs(events, isSimilarMark);
  console.log(`${locale}: ${events.length} events; cross-film hidden pairs old=${oldPairs.length} new=${newPairs.length}`);

  // New rule: any remaining cross-film hiding must be an exactly identical
  // stripped title (e.g. alias films sharing one headline), never Dice.
  for (const [e, f] of newPairs) {
    assert.strictEqual(
      strippedTitleKey(f.headline || f.filmTitle || ""),
      strippedTitleKey(e.headline || e.filmTitle || ""),
      `${locale}: cross-film hide without identical stripped title: ${e.id} -> ${f.id}`,
    );
  }

  if (locale === "zh") {
    const qianfu = events.find((e) => e.filmId === "insidious-out-of-the-further" && (e.headline || "").includes("潜伏6"));
    assert.ok(qianfu, "zh: 潜伏6 event must exist");
    assert.strictEqual(hiddenOthers(events, qianfu, oldIsSimilarMark).length > 0, true, "zh: old rule must mis-hide others for 潜伏6 (sanity)");
    assert.strictEqual(hiddenOthers(events, qianfu, isSimilarMark).length, 0, "zh: blocking 潜伏6 must hide 0 other films now");
    console.log(`zh: blocking 潜伏6 hides others old=${hiddenOthers(events, qianfu, oldIsSimilarMark).length} new=0`);
    // Same-film events still hide together.
    const odyssey = events.filter((e) => e.filmId === "the-odyssey");
    assert.ok(odyssey.length >= 2, "zh: the-odyssey must have 2+ events");
    const sameFilmHidden = events.filter((f) => f.id !== odyssey[0].id && f.filmId === "the-odyssey" && isSimilarMark(f, markFrom(odyssey[0])));
    assert.ok(sameFilmHidden.length >= 1, "zh: blocking one 奥德赛 event must still hide its other events");
  }

  if (locale === "en") {
    const madden = events.find((e) => (e.headline || "").startsWith("Madden"));
    assert.ok(madden, "en: Madden event must exist");
    assert.strictEqual(hiddenOthers(events, madden, oldIsSimilarMark).length > 0, true, "en: old rule must mis-hide others for Madden (sanity)");
    assert.strictEqual(hiddenOthers(events, madden, isSimilarMark).length, 0, "en: blocking Madden must hide 0 other films now");
    console.log(`en: blocking Madden hides others old=${hiddenOthers(events, madden, oldIsSimilarMark).length} new=0`);
  }
}

console.log("ok: dismiss regression passed — no cross-film Dice mis-hiding on the real timeline");
