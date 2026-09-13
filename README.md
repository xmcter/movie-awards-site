# 银幕奖讯 · A类电影节时间线

中文默认的电影节 / 奖项资讯站：一条时间线追踪入围、获奖与相关流媒体日程。

**主跟 FIAPF A 类电影节**（优先三大：暨纳、威尼斯、柏林；亦可含洛迦诺、圣塞巴斯蒂安、上海、东京、釜山、卡罗维发利）。**同时收录**奥斯卡、金球、金马、金像，以及作者性明确、未走三大竞赛的导演影讯。**不收录**华表。

时间线只挂「已发生」的消息日；未来典礼 / 提名日不进时间线。定档新闻挂官方公布日。

## 线上访问

- 站点：[https://news.readcine.com](https://news.readcine.com)
- 仓库：[xmcter/movie-awards-site](https://github.com/xmcter/movie-awards-site)
- 部署：GitHub Pages（Actions 构建 `out/`）+ 仓库根目录 / `public/CNAME` 写 `news.readcine.com`
- 基路径为空（自定义域不要 `/movie-awards-site` prefix）

域名走 Cloudflare。DNS / 源站应指向 `xmcter.github.io`，不要再指国内 ECS（未备案会 403）。推送 `main` 后等 Actions 跑完，必要时在 Cloudflare 清缓存。

Pages 若未启用：Settings → Pages → Source 选 **GitHub Actions**。

## 技术栈

- Next.js App Router + TypeScript（`output: 'export'` 静态导出）
- Tailwind CSS
- 本地 JSON 种子（无 API Key、无登录、无线上爬虫）

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

生产构建：

```bash
npm run build   # 输出到 out/
```

## 页面

单一主页：**时间线**（最新在前）。可按「全部 / 获奖 / 入围 / 作者 / 流媒体」筛选，支持轻量搜索（含导演、奖项）。

同一电影节、同一部片、同一消息日的多个奖项合成一张卡。荣誉奖 / 评委主席仍在时间线，徽章为「荣誉」「评审」，不当普通影片计。

下拉刷新只重载当前静态包，不会爬新奖。新消息要改 JSON 并推送 `main`。

## 数据

| 文件 | 说明 |
|------|------|
| `src/data/films.json` | 影片与流媒体日程 |
| `src/data/ceremonies.json` | 电影节典礼与入围 / 获奖 |
| `src/data/orgs.json` | A 类电影节组织 |
| `src/data/major-awards.json` | 奥斯卡 / 金球 / 金马 / 金像 |
| `src/data/more-catalog.json` / `extra-catalog.json` | 补充影片与典礼 |
| `src/data/auteur-news.json` | 作者向已发生影讯 |

时间线由 `src/lib/data.ts` 的 `getTimelineEvents()` 从种子派生。构建时按当天日期切掉未来事件。

`result`：`nominated` / `won`。`streaming[].status`：`announced` / `estimated` / `tba`。不确定的流媒体日期一律 TBA / estimated，禁止编造已官宣日期。

影片 `genres` 含「荣誉」「评审」时视为人物荣誉 / 评审事件，不是普通影片。

## 海报

时间线卡片使用 `public/posters/{filmId}.jpg`。站点为静态导出，**运行时不依赖 API Key**。

海报仅供个人 / 编辑性展示。

## 许可

MIT
