# What's on Netflix 抓取

```bash
python3 scripts/fetch_whatson_netflix.py
```

- 入口：公开日历 https://www.whats-on-netflix.com/coming-soon/calendar/
- 解析：页面内 `application/ld+json` 的 `Movie` + `datePublished`（YYYY-MM-DD）
- 过滤：剧集 / 纪录片 / 无确切日 / roundup 标题
- UA：`ReadCineBot/1.0`；请求间隔 ≥1.2s
- 产出：`src/data/won-streaming-catalog.json`；合并已有 catalog 的 Netflix announced
- 定时：交 Muse 复跑本脚本；不要新建 Grok 例程
