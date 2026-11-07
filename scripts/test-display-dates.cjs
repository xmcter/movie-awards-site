const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync("src/lib/labels.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} }; new Function("exports", "module", "require", code)(mod.exports, mod, require);
const x = mod.exports, now = new Date("2026-11-07T02:33:00Z");
assert.equal(x.formatDate("2026-11-27", now), "11月27日");
assert.equal(x.formatDate("2027-01-15", now), "2027年1月15日");
assert.equal(x.formatDate("2025-12-31", now), "2025年12月31日");
assert.equal(x.shanghaiYear(new Date("2026-12-31T16:01:00Z")), 2027);
assert.equal(x.formatSourcePublishedLabel("2025-12-31T18:00:00Z", { now }), "原文 1月1日 02:00");
assert.equal(x.formatSourcePublishedLabel("2027-01-15", { now, isOriginal: false }), "收录 2027年1月15日");
assert.equal(x.formatContentDates("上映2026-11-27；制作2026年；2027年1月15日", now), "上映11月27日；制作2026年；2027年1月15日");
console.log("7 display-date tests passed");

// 上海周一边界、月末跨年、周文案优先于下个月。
assert.equal(x.formatReleaseWeek("2026-11-08", new Date("2026-11-08T15:59:00Z")), "本周日出源");
assert.equal(x.formatReleaseWeek("2026-11-08", new Date("2026-11-08T16:01:00Z")), "11月8日出源");
assert.equal(x.formatReleaseWeek("2026-11-13", new Date("2026-11-07T02:00:00Z")), "下周五出源");
assert.equal(x.formatReleaseWeek("2026-11-27", new Date("2026-11-07T02:00:00Z")), "11月27日出源");
assert.equal(x.formatReleaseWeek("2026-12-05", new Date("2026-11-07T02:00:00Z")), "下个月5号出源");
assert.equal(x.formatReleaseWeek("2027-01-15", new Date("2026-12-20T02:00:00Z")), "下个月15号出源");
assert.equal(x.formatReleaseWeek("2027-01-01", new Date("2026-12-27T02:00:00Z")), "下周五出源");
assert.equal(x.formatReleaseWeek("2027-01-01", new Date("2026-12-31T16:01:00Z")), "本周五出源");
assert.equal(x.formatReleaseWeek("2027-02-15", new Date("2026-12-20T02:00:00Z")), "2027年2月15日出源");
assert.equal(x.formatReleaseWeek("2026-12-20", new Date("2026-11-30T15:59:00Z")), "下个月20号出源");
assert.equal(x.formatReleaseWeek("2026-12-20", new Date("2026-11-30T16:01:00Z")), "12月20日出源");
console.log("11 relative week/month boundary tests passed");
