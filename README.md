# 银幕新讯 · news.readcine.com

中文时间线：**新片流媒体定档**与**出资源站内通知**。不收院线爆米花；**时间线不进影展/奖项刷屏**。

编辑标准见仓库根目录 `EDITORIAL.md`。

## 线上

- **主站**：https://news.readcine.com
- 仓库：https://github.com/xmcter/movie-awards-site
- ECS 静态根：`/var/www/movie-awards-site`

## 技术

- Next.js App Router + TypeScript（`output: 'export'`）
- Tailwind CSS
- 本地 JSON 种子；时间线由 `src/lib/data.ts` 派生
- 列表标题由 `src/lib/headlines.ts` 生成

## 本地

```bash
npm ci
npm run validate
npm run build   # 输出 out/
npm run dev
```

## 页面

- `/` 时间线（定档 / 已上线 / 出资源）
- `/film/[id]` 影片详情（流媒体字段、档案）
- `/event/[id]` 单条消息详情

## 部署

Push `main` → 构建 `out/` → 备份后原子替换 ECS `/var/www/movie-awards-site`。可选：

```bash
./deploy/deploy.sh
```

## 定档数据脚本

- What's on Netflix（美区 Netflix 日历，可复跑、幂等）：

```bash
python3 scripts/fetch_whatson_netflix.py
python3 scripts/fetch_whatson_netflix.py --dry-run
npm run validate && npm run build
```

  写入 `src/data/won-streaming-catalog.json`，并与已有片库按 id/titleEn 合并 Netflix `announced`（同平台同日跳过；不删 WTS 其它平台条目）。

- Movie of the Night / Streaming Availability（美区 upcoming，可复跑、幂等）：

```bash
export MOTN_API_KEY='…'
python3 scripts/fetch_motn_upcoming.py
python3 scripts/fetch_motn_upcoming.py --dry-run
npm run validate && npm run build
```

  写入 `src/data/motn-streaming-catalog.json`；catalogs=`netflix,disney,prime,apple,hbo,mubi`；同平台同日跳过，不覆盖 WTS/WON 已有 announced 日期。说明见 `scripts/README-motn-scrape.md`。

- When To Stream / WON / MotN 定时抓取交 Muse；本仓库不新建 Grok 例程。
- 勿把 API 密钥写入仓库。

