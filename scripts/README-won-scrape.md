# What's on Netflix 抓取

```bash
python3 scripts/fetch_whatson_netflix.py
python3 scripts/fetch_whatson_netflix.py --dry-run
python3 scripts/fetch_whatson_netflix.py --report /tmp/won-report.json
```

- 入口：公开日历 https://www.whats-on-netflix.com/coming-soon/calendar/
- 解析：页面内 `application/ld+json` 的 `Movie` + `datePublished`（YYYY-MM-DD）
- 过滤：剧集 / 纪录片 / 无确切日 / roundup 标题
- UA：`ReadCineBot/1.0`；请求间隔 ≥1.2s
- 产出：`src/data/won-streaming-catalog.json`；按 title / titleEn 合并已有 catalog 的 Netflix announced
- 定时：交 Muse 复跑本脚本；不要新建 Grok 例程

## 海报

JSON-LD `image` 默认下载到 `public/posters/`，校验 Content-Type 与文件头（JPEG/PNG/WebP），扩展名按真实格式。`poster` 写 `/posters/{id}.jpg`（或 `.png` / `.webp`）。下载失败回退远程 URL，记入 report 的 `poster_download_failed`；没有 https 图记入 `poster_no_image`。`--no-localize-posters` 或 `WON_LOCALIZE_POSTERS=0` 关闭下载（命令行优先）。`--dry-run` 不下载，只在 `poster_would_download` 列出将要抓的图。

## 文案（不编造中文简介）

- `genres` 只从 JSON-LD `description` 里的类型词推断（喜剧、惊悚等）。描述只有 “Licensed” / “Netflix Original” 时 `genres` 为 `[]`，不再写死 `["剧情"]`。
- `synopsis` 留空。不写「流媒体定档来自 What's on Netflix」这类模板句。
- 中文译名：先查 MotN 脚本里的 `KNOWN_TITLE_ZH`（按 slug）。没有则 `title` 暂留英文。
- 再查 `src/data/film-copy.json` 里同 id 的条目。有 `title` / `synopsis` / `directors` / `cast` / `genres` / `country` 就写入。这是现成补录流程；页面读取时 `applyCopy` 还会再盖一层，所以只补 film-copy、不重跑脚本，详情页也会更新。
- 仍然缺中文的，影片上写 `copyPending`：`title`（无汉字译名）、`synopsis`（简介待人工补）。不要在脚本里编中文剧情。

补录示例（id 与 catalog 里的 `id` 一致）：

```json
"some-film-id": {
  "title": "核实过的中文译名",
  "synopsis": "人工写的简介，不要用脚本生成。"
}
```

## 日期与 slug

- 同平台已有 `announced` 日期，且与 WON 日历不一致：不改原日期，写入 report 的 `date_conflicts`，等人确认。已入库的日期优先。
- 建新片前用 slug 对全部 catalog 的 `id`（含 `films.json`、`movie-peek-catalog.json`）查重。撞上另一部片的 id 时写入 `slug_collisions`，不入库、不覆盖。
- 日历解析后 `confirmed` 为 0：告警并重试 3 次（退避 2s / 4s / 8s，连同第一次共 4 次）。仍然是 0 则退出码 1，不写 catalog。抓取本身失败退出码 2。
