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
