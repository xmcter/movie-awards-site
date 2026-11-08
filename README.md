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

- 片库 Peek 出资源（可复跑、幂等）。仓库里没有 SSH 主机、密钥路径或内网 API 的默认值，下面的取值只是示例：

```bash
export PEEK_SSH_HOST='user@203.0.113.10'       # SSH 目标，示例
export PEEK_SSH_IDENTITY='~/.ssh/id_ed25519'   # 私钥路径，示例
export PEEK_API_BASE='http://127.0.0.1:8080'   # SSH 主机上的内网 API 源，无路径，示例
# 或者把上面三行写成 KEY=VALUE 文件，未导出的变量才从文件补上：
# export PEEK_CONFIG=/path/to/peek.env
python3 scripts/ingest_movie_peek_resources.py --dry-run
python3 scripts/ingest_movie_peek_resources.py
```

  `--ssh-host`、`--identity`、`--api-base` 覆盖环境变量和 `PEEK_CONFIG`。脚本经 SSH 在对端请求内网 `/api/peek` 与 `/api/movie_detail`，不读密钥内容，也不把网盘地址或提取码写入仓库。`--dry-run` 不改文件，并在 `posters_to_localize` 列出待本地化海报（影片、远程 URL、目标 `/posters/{id}.jpg`）。豆瓣图床与 `image.tmdb.org` 都会列入；已有 `/posters/` 路径不会被远程 URL 盖掉。单片详情失败会再试 2 次，仍失败则记入 `detail_failures` 并跳过该片，不中断整批。列表接口 `/api/peek` 同样重试 2 次，仍失败则退出且不写 catalog。

- When To Stream / WON / MotN 定时抓取交 Muse；本仓库不新建 Grok 例程。
- 勿把 API 密钥、SSH 主机或密钥路径写入仓库。

