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
- 来源标签：`sourceLabel=Movie of the Night`
- 密钥：只走环境变量 `MOTN_API_KEY`（或 `MOTN_KEY_FILE`）；勿写入仓库
- 定时：交 Muse 复跑；不要新建 Grok 例程
