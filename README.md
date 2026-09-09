# 银幕奖讯 · A类电影节时间线

中文默认的 **FIAPF A 类电影节** 资讯站：一条时间线追踪入围、获奖与相关流媒体预计上线。

**只覆盖 A 类电影节**（优先三大：戛纳、威尼斯、柏林；亦可含洛迦诺、圣塞巴斯蒂安、上海、东京、釜山等）。**不收录**奥斯卡、金球、金马、金像、华表等。

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

单一主页：**时间线**（最新在前）。顶部可按「全部 / 获奖 / 入围 / 流媒体」筛选，并支持轻量搜索。

## 数据

| 文件 | 说明 |
|------|------|
| `src/data/films.json` | 影片与流媒体日程 |
| `src/data/ceremonies.json` | 电影节典礼与入围 / 获奖 |
| `src/data/orgs.json` | A 类电影节组织 |

时间线事件由 `src/lib/data.ts` 的 `getTimelineEvents()` 从上述种子派生。

`result`：`nominated`（入围）或 `won`（获奖）。`streaming[].status`：`announced` / `estimated` / `tba`。不确定的流媒体日期一律 TBA/estimated，禁止编造已官宣日期。

## 部署

```bash
./deploy/deploy.sh
```

默认 rsync `out/` → `root@8.134.173.91:/var/www/movie-awards-site/`（密钥 `~/.ssh/aliyun_movieupdate`）。域名：http://news.readcine.com

## 许可

MIT
