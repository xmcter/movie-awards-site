/** Offline regression: real timeline, publication order, import stamps and public UI. */
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
const { comparePublicationTime, publicationTime } = require("../src/lib/timelineOrder.ts");
const { getTimelineEvents, auteurNews, films, FILM_ALIASES } = require("../src/lib/data.ts");
const { buildMarker, isNewSince } = require("../src/lib/lastSeen.ts");
const events = getTimelineEvents();
assert.ok(events.length > 0);
assert.ok(events.every(e => Number.isFinite(Date.parse(e.publishedAt))));
for (let i = 1; i < events.length; i++) {
  assert.ok(comparePublicationTime(events[i - 1], events[i]) <= 0, `Not publication ordered: ${events[i].id}`);
}
const newer = { id: "new", publishedAt: "2026-11-06T21:00:00+08:00", date: "2026-11-01" };
const older = { id: "old", publishedAt: "2026-11-05T21:00:00+08:00", date: "2026-12-30" };
assert.deepEqual([older, newer].sort(comparePublicationTime).map(e => e.id), ["new", "old"]);
assert.equal(buildMarker([older, newer]).id, "new");
assert.equal(isNewSince(newer, buildMarker([older])), true);
assert.equal(publicationTime(newer), newer.publishedAt);
for (const e of events.filter(e => e.type === "streaming")) {
  // 事件 filmId 是规范片名；定档数据可能挂在别名记录上（如 la-bola-negra -> the-black-ball），
  // 事件 id 保留的是来源记录的 id。
  const sourceFilms = films.filter(f => f.id === e.filmId || FILM_ALIASES[f.id] === e.filmId);
  const hit = sourceFilms
    .flatMap(f => f.streaming.map(r => ({ filmId: f.id, release: r })))
    .find(({ filmId, release }) => `stream-${filmId}-${release.platform}-${release.date || "tba"}` === e.id);
  assert.ok(hit, e.id);
  assert.equal(e.publishedAt, hit.release.publishedAt);
  // 定档标题允许写上线日；列表另以 sourcePublishedLabel 展示原文/收录时间
}
for (const e of events.filter(e => e.type === "auteur")) {
  const item = auteurNews.find(n => `auteur-${n.id}` === e.id);
  assert.equal(e.publishedAt, item.publishedAt || `${item.date}T00:00:00+08:00`);
}
const ui = fs.readFileSync(path.join(root, "src/components/Timeline.tsx"), "utf8");
assert.ok(!ui.includes("<time"), "Timeline must not use <time> for 定档日");
assert.ok(ui.includes("sourcePublishedLabel") || ui.includes("publishedLabel"), "Source publish label should render on cards");
assert.ok(ui.includes('"来源"}·${label}'), "Source chip should use 来源· prefix");
assert.ok(!ui.includes("absoluteDayLabel"), "Date group headings should not render");
assert.ok(!ui.includes("PIN_NEW"), "No type pinning may override publication order");
for (const filename of ["src/components/Timeline.tsx", "src/app/film/[id]/page.tsx", "src/app/event/[id]/page.tsx", "src/data/auteur-news.json"]) {
  const source = fs.readFileSync(path.join(root, filename), "utf8");
  assert.ok(!/找资源|movie\.readcine\.com/.test(source), filename);
}
for (const filename of ["src/components/Timeline.tsx", "src/app/film/[id]/page.tsx", "src/app/event/[id]/page.tsx"]) {
  const source = fs.readFileSync(path.join(root, filename), "utf8");
  assert.ok(source.includes("<WeiboLink"), filename);
  assert.ok(source.includes("guideUrl") || source.includes("guide.readcine.com"), filename);
}
console.log(`ok: ${events.length} real events ordered by publication; no timeline dates/resource links; Weibo and guide retained`);
console.log("Newest:", events.slice(0, 5).map(e => `${e.publishedAt} ${e.id}`).join("\n"));

if (process.argv.includes("--built")) {
  const out = path.join(root, "out");
  function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  }
  const htmlFiles = walk(out).filter(f => f.endsWith(".html"));
  for (const file of htmlFiles) {
    assert.ok(!/找资源|movie\.readcine\.com/.test(fs.readFileSync(file, "utf8")), file);
  }
  const home = fs.readFileSync(path.join(out, "index.html"), "utf8");
  assert.ok(!home.includes("<time"), "Built home must not show dates");
  const ids = [...home.matchAll(/data-event-id="([^"]+)"/g)].map(m => m[1]);
  const seen = new Set();
  const expected = events.filter(e => {
    if (seen.has(e.filmId)) return false;
    seen.add(e.filmId);
    return true;
  }).map(e => e.id);
  assert.deepEqual(ids, expected, "Built card order must follow publication, with same-film dedup only");
  for (const n of auteurNews.filter(n => n.id.startsWith("movie-peek-"))) {
    for (const file of ["index.html", `film/${n.filmId}.html`, `event/auteur-${n.id}.html`]) {
      const html = fs.readFileSync(path.join(out, file), "utf8");
      assert.ok(html.includes(`href="${n.weiboUrl}"`), `Weibo missing in ${file}`);
    }
  }
  console.log(`ok: ${htmlFiles.length} exported HTML files clean; ${ids.length} built cards publication-sorted; all 6 Weibo anchors retained`);
}
