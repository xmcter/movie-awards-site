# 银幕新讯 · 作者向新片与奖讯时间线

不再只做「获奖资讯」。主跟作者向新片的定档、上映、流媒体，同时收 A 类电影节与四大奖的入围 / 获奖。

## 收什么 / 不收什么

**收**

- 作者性明确的新片：定档、首映、院线、流媒体、制作进度
- FIAPF A 类电影节（优先暨纳、威尼斯、柏林）入围与获奖
- 奥斯卡、金球、金马、金像
- 影评纯度 RT Tomatometer（或等价）**80%+** 的作者向影片；只有观众分不算

**不收**

- 院线爆米花、超级英雄连载、纯票房娱乐片
- 华表
- 未发生的典礼 / 提名日（不进时间线）
- 编造的流媒体日期

票房数字本身不是入库理由。

时间线只挂「已发生」的消息日。定档新闻挂官方公布日。

## 线上访问

- 站点：[https://news.readcine.com](https://news.readcine.com)
- 仓库：[xmcter/movie-awards-site](https://github.com/xmcter/movie-awards-site)
- 部署：GitHub Pages（Actions 构建 `out/`）

域名走 Cloudflare，源站指 `xmcter.github.io`，不要指国内 ECS。

## 技术栈

- Next.js App Router + TypeScript（`output: 'export'`）
- Tailwind CSS
- 本地 JSON 种子

## 本地运行

```bash
npm install
npm run dev
```

## 页面

单一主页时间线。筛选：全部 / 新品 / 获奖 / 入围 / 流媒体。

新消息改 JSON 并推 `main`。

## 数据

| 文件 | 说明 |
|------|------|
| `src/data/films.json` | 影片与流媒体日程 |
| `src/data/ceremonies.json` | 电影节典礼 |
| `src/data/auteur-news.json` | 作者向已发生影讯（定档 / 上映 / 预告） |
| `src/data/major-awards.json` | 奥斯卡 / 金球 / 金马 / 金像 |
| `src/data/more-catalog.json` / `extra-catalog.json` | 补充 |

## License

MIT
