# 影片详情加厚 · 笔记

日期：2026-09-25（UTC+8）

## 改动摘要

- **主数据**：`src/data/film-copy.json` 扩写 synopsis / background / runtime / cast（92 部目录片均有 background；其中 **64** 部同时具备 ≥40 字剧情介绍 + ≥20 字创作背景）。
- **合并**：`src/lib/data.ts` 的 `applyCopy` 现合并 `runtime` / `country` / `genres` / `title*`。
- **页面**：`/film/[id]` 区块改为「剧情介绍」「创作背景」「导演与主演」「本站相关奖项」；头图 meta 显示国家 · 片长 · 年份。
- **脚本**：`scripts/build-film-copy.mjs` + `scripts/cache/tmdb-enrich.json`（TMDB 简中 overview 缓存；错误匹配 id 已黑名单）。
- **纠错**：数据与 layout 中「暨纳／曦纳」→「戛纳」。

## 自测

```bash
npm run validate
npm run build
# 抽查 out/film/fjord.html、ink.html、one-battle.html 含「剧情介绍」「创作背景」
```

## 仍薄 / 从略

荣誉与评审条目、公开剧情极少的金像／金马演员奖条目：仅有诚实奖项／人物背景，不编造情节。  
36 条 ceremony 提名指向目录外 filmId（validate 已 warn），未在本次补 stub。

## 示例 URL

- https://news.readcine.com/film/fjord
- https://news.readcine.com/film/ink
- https://news.readcine.com/film/one-battle
