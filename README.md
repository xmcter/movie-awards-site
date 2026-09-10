# 银幕奖讯 · A类电影节时间线

中文默认的 **FIAPF A 类电影节** 资讯站：一条时间线追踪入围、获奖与相关流媒体预计上线。

**只覆盖 A 类电影节**（优先三大：曙纳、威尼斯、柏林；亦可含洛迦诺、圣塞巴斯蒂安、上海、东京、釜山等）。**不收录**奥斯卡、金球、金马、金像、华表等。

## 线上访问（重要）

`http://news.readcine.com` 指向阿里云广州 ECS（`8.134.173.91`）。域名未在工信部备案 / 未在阿里云接入备案，阿里云 Beaver 会返回 **403 备案阻断**，HTTPS 443 未开。

解法：改到海外托管。仓库已加 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)，构建已通过。

**你需要点一次**（代码权限无法代开 GitHub Pages）：

1. 打开 [Settings → Pages](https://github.com/xmcter/movie-awards-site/settings/pages)
2. Build and deployment → Source 选 **GitHub Actions**
3. 打开 [Actions 失败的那次跑](https://github.com/xmcter/movie-awards-site/actions/workflows/pages.yml) → Re-run jobs

上线后地址：**https://xmcter.github.io/movie-awards-site/**

要恢复 `news.readcine.com`：把 DNS 从 `8.134.173.91` 改成 GitHub Pages（`CNAME` → `xmcter.github.io`），再在仓库根目录加 `CNAME` 文件写 `news.readcine.com`，并把 `GITHUB_PAGES` 基路径改回空（自定义域名不需要 `/movie-awards-site` prefix）。

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

`ceremonies[].date` / 可选的 `nominations[].date` 是**消息 / 事件发生日**（颁奖夜、片单公布日、荣誉奖宣布日等），不是页面部署或刷新时间。下拉刷新只会重新加载静态页，不会改写这些日期。

`result`：`nominated`（入围）或 `won`（获奖）。`streaming[].status`：`announced` / `estimated` / `tba`。不确定的流媒体日期一律 TBA/estimated，禁止编造已官宣日期。

## 旧版：阿里云 rsync（被备案拦，仅留档）

```bash
./deploy/deploy.sh
```

默认 rsync `out/` → `root@8.134.173.91:/var/www/movie-awards-site/`。未备案域名不要再指这台国内机器。

## 海报图片

时间线卡片使用 `public/posters/{filmId}.jpg` 本地海报（由影片 `poster` 字段引用）。站点为静态导出，**运行时不依赖 API Key**。

海报仅供个人 / 编辑性展示；若许可要求，请替换为自有授权素材。来源多为公开宣传图（如 TMDB 可公开访问的海报路径），不保证可商用再分发。

## 许可

MIT
