# 银幕新讯 · news.readcine.com

中文默认的作者向新片 / 电影节 / 影奖时间线：入围、获奖、流媒体与作者向动态。

覆盖 **FIAPF A 类电影节**（戛纳、威尼斯、柏林等）以及 **奥斯卡、金球、金马、金像**。不收院线爆米花与超级英雄连载。

## 线上

- **主站**：https://news.readcine.com （GitHub Pages + 自定义域名，`basePath` 为空）
- 仓库：https://github.com/xmcter/movie-awards-site

## 技术

- Next.js App Router + TypeScript（`output: 'export'`）
- Tailwind CSS
- 本地 JSON 种子；时间线由 `src/lib/data.ts` 派生
- 列表标题由 `src/lib/headlines.ts` 生成醒目新闻标题
- 海报：`public/posters/{id}.jpg`（构建时自动挂载）

## 本地

```bash
npm ci
npm run validate
npm run build   # 输出 out/
npm run dev
```

## 页面

- `/` 时间线（全部 / 新片 / 获奖 / 入围或提名 / 流媒体）
- `/film/[id]` 影片详情（剧情、导演、主演、奖讯、流媒体）
- `/event/[id]` 单条消息详情

`ceremonies[].date` / `nominations[].date` / `auteur-news[].date` 是**消息时间**，不是部署时间。

## 海报脚本

```bash
node scripts/fetch-posters.mjs
```

## 部署

Push `main` → GitHub Actions Pages。可选 ECS：

```bash
./deploy/deploy.sh
```
