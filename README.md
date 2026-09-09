# 银幕奖讯 · 电影奖讯时间线

中文默认的电影奖项资讯站：一条**时间线**追踪提名、获奖与流媒体预计上线时间。

覆盖奖项：奥斯卡、金球奖、戛纳、威尼斯、柏林、金马奖、香港金像奖、华表奖。

## 技术栈

- [Next.js](https://nextjs.org/) App Router + TypeScript（`output: 'export'` 静态导出）
- Tailwind CSS
- 本地 JSON 种子数据（无需 API Key、无需登录）

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

单一主页：**时间线**（最新在前）。顶部可按「全部 / 提名 / 获奖 / 流媒体」筛选，并支持轻量搜索。

## 数据

| 文件 | 说明 |
|------|------|
| `src/data/films.json` | 影片与流媒体日程 |
| `src/data/ceremonies.json` | 典礼与提名 / 获奖 |
| `src/data/orgs.json` | 奖项组织 |

时间线事件由 `src/lib/data.ts` 的 `getTimelineEvents()` 从上述种子派生。

### 扩展示例

在 `films.json` 追加影片（含 `streaming`），或在 `ceremonies.json` 追加提名：

```json
{
  "categoryId": "best-picture",
  "categoryName": "最佳影片",
  "filmId": "your-film-id",
  "result": "nominated"
}
```

`result`：`nominated`（提名）或 `won`（获奖）。`streaming[].status`：`announced` / `estimated` / `tba`。

## 部署

静态文件部署到阿里云 nginx：

```bash
./deploy/deploy.sh
```

默认 rsync `out/` → `root@8.134.173.91:/var/www/movie-awards-site/`（密钥 `~/.ssh/aliyun_movieupdate`）。域名：http://news.readcine.com

## 设计

深色影院风格，中文 UI，移动端友好。

## 许可

MIT
