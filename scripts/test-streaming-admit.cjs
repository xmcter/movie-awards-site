/** Unit tests for shouldAdmitStreaming. Reads catalogs; does not write them. */
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

const {
  shouldAdmitStreaming,
  streamingQualityScore,
  streamingNewFilmMinYear,
  STREAMING_ALLOWLIST,
  isAllowlistedStreamingFilm,
  isTimelineEligibleFilm,
  getComingSoonReleases,
  films,
  ceremonies,
  FILM_ALIASES,
} = require("../src/lib/data.ts");

const NOW = new Date("2026-11-08T12:00:00+08:00");
const FILLER = /圣诞|圣诞节|Christmas|Holiday|Tyler Perry|泰勒|Paw Patrol|汪汪队|Warrior Kid|战士小子|Bag Man|提袋人|节日迷雾|威斯康星圣诞|快乐窃贼|完美骗子|壁炉/i;
const auteurEntries = JSON.parse(fs.readFileSync(path.join(root, "src/data/auteur-directors.json"), "utf8"));
const auteurNames = auteurEntries.flatMap((entry) => entry.names);

function film(partial) {
  return {
    id: "unit-test-film",
    title: "单元测试片",
    titleEn: "Unit Test Film",
    year: 2026,
    synopsis: "",
    directors: ["单元测试无关导演"],
    cast: [],
    genres: ["剧情"],
    streaming: [],
    ...partial,
  };
}

function matchesAuteur(directors) {
  const blob = (directors || []).join(" ");
  return auteurNames.some((name) => blob.includes(name));
}

const dataSrc = fs.readFileSync(path.join(root, "src/lib/data.ts"), "utf8");
assert.match(dataSrc, /auteur-directors\.json/);
assert.doesNotMatch(dataSrc, /const AUTEUR_DIRECTORS = \[/);
assert.doesNotMatch(dataSrc, /MAX_EVENTS_PER_DAY/);
assert.match(dataSrc, /const CORE_FILM_IDS = new Set\(\(filmsData as Film\[\]\)\.map/);
assert.match(dataSrc, /if \(CORE_FILM_IDS\.has\(film\.id\) \|\| film\.id in filmCopy\)/);
assert.doesNotMatch(dataSrc, /function streamingQualityScore[\s\S]*?new Set\(/);
assert.ok(auteurEntries.every((entry) => Array.isArray(entry.names) && entry.names.length > 0 && typeof entry.note === "string"));
assert.ok(auteurNames.includes("Lisandro Alonso"));
assert.ok(auteurNames.includes("利桑德罗·阿隆索"));

assert.equal(streamingNewFilmMinYear(NOW), 2024);

// 新片年窗：年窗外硬拒，作者、获奖、MUBI 都不能翻案。
const weapons = films.find((item) => item.id === "weapons");
assert.ok(weapons, "weapons should be in the catalog");
assert.equal(matchesAuteur(weapons.directors), false);
assert.equal(shouldAdmitStreaming({ ...weapons, year: 2023 }, "mubi", NOW), false);
assert.equal(shouldAdmitStreaming(film({ year: 2023, directors: ["诺兰"] }), "mubi", NOW), false);
assert.equal(shouldAdmitStreaming(film({ year: undefined }), "mubi", NOW), false);
assert.equal(shouldAdmitStreaming(film({ year: 2024, directors: ["诺兰"] }), "netflix", NOW), true);

// 作者：窗内直接收，不必是 MUBI，也不必在典礼表里。
assert.equal(shouldAdmitStreaming(film({ id: "unit-alonso", directors: ["Lisandro Alonso"] }), "netflix", NOW), true);
assert.equal(shouldAdmitStreaming(film({ id: "unit-yunchan", directors: ["李云禅"] }), "prime", NOW), true);
assert.equal(shouldAdmitStreaming(film({ id: "unit-javis", directors: ["Javier Ambrossi"] }), "netflix", NOW), true);
assert.equal(shouldAdmitStreaming(film({ id: "unit-inarritu", directors: ["亚历杭德罗·冈萨雷斯·伊尼亚里图"] }), "prime", NOW), true);

// 获奖：典礼里有提名的片，导演不在作者名单也收。
assert.equal(shouldAdmitStreaming(weapons, "prime", NOW), true);

// MUBI：窗内、无作者、无奖项也收。
const plain = film({ id: "unit-plain" });
assert.equal(matchesAuteur(plain.directors), false);
assert.equal(shouldAdmitStreaming(plain, "mubi", NOW), true);

// 阈值：短路都不中时，分数不到 25 不收。核心片库只有 +20，仍低于门槛。
assert.ok(streamingQualityScore(plain, "prime") < 25);
assert.equal(shouldAdmitStreaming(plain, "prime", NOW), false);
assert.ok(streamingQualityScore(plain, "netflix") < streamingQualityScore(plain, "prime"));
assert.equal(shouldAdmitStreaming(plain, "netflix", NOW), false);
assert.ok(streamingQualityScore(film({ id: "unit-no-director", directors: [] }), "prime") < 25);
assert.equal(shouldAdmitStreaming(film({ id: "unit-no-director", directors: [] }), "prime", NOW), false);

const filler = film({
  id: "unit-filler",
  title: "圣诞壁炉",
  titleEn: "Christmas Fireplace",
});
assert.ok(streamingQualityScore(filler, "prime") < 25);
assert.equal(shouldAdmitStreaming(filler, "prime", NOW), false);

const filmsJson = JSON.parse(fs.readFileSync(path.join(root, "src/data/films.json"), "utf8"));
const awardedIds = new Set(ceremonies.flatMap((ceremony) => (ceremony.nominations || []).map((nom) => nom.filmId)));
const core = filmsJson.find((item) => (
  item.year >= 2024 &&
  item.directors?.length &&
  !awardedIds.has(item.id) &&
  !matchesAuteur(item.directors) &&
  !FILLER.test(`${item.title || ""} ${item.titleEn || ""}`)
));
assert.ok(core, "expected a core film that only earns the catalog bonus");
const coreFilm = film({
  id: core.id,
  title: core.title,
  titleEn: core.titleEn || "",
  year: core.year,
  directors: core.directors,
});
assert.equal(streamingQualityScore(coreFilm, "apple-tv"), 20);
assert.equal(shouldAdmitStreaming(coreFilm, "apple-tv", NOW), false);

// 人工放行名单：用户 2026-11-13 定，B.1 建议的 8 部全放行。分数不够也收，
// 纪录片《第十四条》也进时间线与即将上线；未放行的纪录片仍排除。
assert.equal(STREAMING_ALLOWLIST.size, 8);
const ALLOWLISTED = [
  ["avengers-endgame-encore", "disney-plus"],
  ["madame-web", "max"],
  ["the-samurai-and-the-prisoner", "other"],
  ["the-super-mario-galaxy-movie", "netflix"],
  ["maddies-secret", "netflix"],
  ["batman-knightfall-part-2-knightquest", "other"],
  ["the-sun-never-sets", "other"],
  ["fourteenth", "netflix"],
];
for (const [id, platform] of ALLOWLISTED) {
  const f = films.find((item) => item.id === id);
  assert.ok(f, `${id} should be in the catalog`);
  assert.ok(streamingQualityScore(f, platform) < 25, `${id} is expected to fail the score gate without the allowlist`);
  assert.equal(isAllowlistedStreamingFilm(f), true, `${id} allowlisted`);
  assert.equal(shouldAdmitStreaming(f, platform, NOW), true, `${id} admitted`);
  assert.equal(isTimelineEligibleFilm(f), true, `${id} timeline-eligible`);
}
// 年窗仍硬卡：放行名单里的老片回档也不收。
assert.equal(shouldAdmitStreaming(film({ id: "avengers-endgame-encore", year: 2023 }), "disney-plus", NOW), false);
// 未放行的纪录片仍排除。
assert.equal(isTimelineEligibleFilm(film({ genres: ["纪录片"] })), false);
// 即将上线页：8 部都在（今天 2026-11-13，含当天上线的安可版）。
const soonIds = new Set(
  getComingSoonReleases(new Date("2026-11-13T12:00:00+08:00")).map((r) => r.filmId),
);
for (const [id] of ALLOWLISTED) {
  const shown = FILM_ALIASES[id] || id;
  assert.ok(soonIds.has(shown), `${id} should be in coming-soon as ${shown}`);
}

console.log("ok: shouldAdmitStreaming covers year window, auteur, award, MUBI, and score threshold");
