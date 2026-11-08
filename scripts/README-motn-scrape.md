# Movie of the Night（Streaming Availability）upcoming 抓取

```bash
export MOTN_API_KEY='…'   # Free key from https://developers.movieofthenight.com/
python3 scripts/fetch_motn_upcoming.py
python3 scripts/fetch_motn_upcoming.py --dry-run
npm run validate && npm run build
```

- 入口：`GET https://api.movieofthenight.com/v4/changes?change_type=upcoming`
- 范围：`country=us`，`show_type=movie`，catalogs=`netflix,disney,prime,apple,hbo,mubi`
- 过滤：无确切 timestamp / 剧集 / 纪录片 / 非支持平台
- 产出：`src/data/motn-streaming-catalog.json`；按 id/titleEn 合并已有片库
- 去重：同平台同日 `announced` 跳过；已有同平台其它日 announced（WTS/WON）不覆盖
- 来源标签：`sourceLabel=片夜定档`（与脚本 `SOURCE_LABEL` 一致；旧英文 `Movie of the Night` 在前端仍会归一成「片夜定档」）
- 元数据：`genres`、`country` 只用 API 原值。缺 genres 写 `[]`，缺制片国则不写 `country`。不再默认 `["剧情"]` 或 `["美国"]`（美国只是片库地区，不是制片国）。英文 overview 原样放进 `synopsis`，并在 `copyPending` 标 `synopsis`（待翻译）。无 overview 时简介为空，同样标待补，不写「流媒体定档」模板句。
- 中文译名：`KNOWN_TITLE_ZH`（按 slug）。没有则标题暂留英文，`copyPending` 含 `title`。`src/data/film-copy.json` 同 id 的 title / synopsis / directors / cast / genres / country 在入库时覆盖；页面 `applyCopy` 也会覆盖。译名确认后再补进译名表或 film-copy，不要编造。
- 海报：默认下载到 `public/posters/`，`poster` 写 `/posters/{id}.jpg`（内容是 PNG/WebP 时用对应扩展名）。`--no-localize-posters` 关闭本地化，只保留 MotN 远程 URL。`MOTN_LOCALIZE_POSTERS=0` 同样关闭（命令行优先于环境变量）。下载失败回退远程 URL，并在 report 的 `poster_download_failed` 里记录；API 没有可用图时记入 `poster_no_image`，两者分开。
- 密钥：只走环境变量 `MOTN_API_KEY`（或 `MOTN_KEY_FILE`）；勿写入仓库
- 定时：交 Muse 复跑；不要新建 Grok 例程
