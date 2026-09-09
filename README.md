# 银幕奖讯 · 电影获奖资讯站

中文默认的电影奖项资讯网站：追踪**提名**、**获奖**与流媒体**预计上线**时间。

覆盖奖项：奥斯卡、金球奖、戛纳、威尼斯、柏林、金马奖、香港金像奖、华表奖。

## 技术栈

- [Next.js](https://nextjs.org/) App Router + TypeScript
- Tailwind CSS
- 本地 JSON 种子数据（无需 API Key、无需登录）

## 本地运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

## 页面结构

| 路径 | 说明 |
|------|------|
| `/` | 首页：近期获奖、典礼氛围、即将上线 |
| `/awards` | 奖项组织列表 |
| `/awards/[orgId]` | 某奖项历届典礼 |
| `/awards/[orgId]/[ceremonyId]` | 典礼详情：按类别展示提名 / 获奖 |
| `/films/[id]` | 影片详情：简介、获奖纪录、流媒体日程 |
| `/streaming` | 流媒体日历，可按平台筛选 |
| `/search` | 搜索影片、人物、奖项 |

## 目录结构

```
src/
  app/           # 页面（App Router）
  components/    # UI 组件
  data/          # JSON 种子数据
  lib/           # 数据读取、标签文案
  types/         # TypeScript 类型
```

## 如何扩展数据

### 添加影片

编辑 `src/data/films.json`，追加对象：

```json
{
  "id": "your-film-id",
  "title": "中文片名",
  "titleEn": "English Title",
  "year": 2025,
  "synopsis": "简介…",
  "directors": ["导演"],
  "cast": ["演员"],
  "genres": ["剧情"],
  "posterColors": ["#1a1a2e", "#16213e"],
  "streaming": [
    {
      "platform": "netflix",
      "date": "2025-06-01",
      "status": "announced",
      "region": "全球"
    }
  ]
}
```

`streaming[].status` 取值：

- `announced` — 已公布
- `estimated` — 预计
- `tba` — 待定（可省略 `date`）

`platform` 取值见 `src/types/index.ts` 中的 `StreamingPlatform`。

### 添加奖项组织

编辑 `src/data/orgs.json`，并在 `src/types/index.ts` 的 `AwardOrgId` 中补充对应 id。

### 添加典礼与提名/获奖

编辑 `src/data/ceremonies.json`：

```json
{
  "id": "oscars-98",
  "orgId": "oscars",
  "name": "第98届奥斯卡金像奖",
  "year": 2026,
  "date": "2026-03-01",
  "nominations": [
    {
      "categoryId": "best-picture",
      "categoryName": "最佳影片",
      "filmId": "your-film-id",
      "personNames": ["可选人物"],
      "result": "nominated"
    }
  ]
}
```

`result` 为 `nominated`（提名）或 `won`（获奖）。`filmId` 须对应 `films.json` 中的 id。

### 添加人物（供搜索）

编辑 `src/data/people.json`。

## 设计说明

深色影院编辑风格，中文 UI 文案，移动端友好。海报使用渐变色块 + 片名首字占位，无需真实图片资源。

## 许可

MIT
