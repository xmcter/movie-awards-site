# news.readcine.com 编辑标准（2026-11-05：流媒体定档 · 出资源通知）

站点定位：从「影展/奖项时间线」收敛为**「流媒体定档 · 出资源通知」**。只告诉影迷两件事——**这部新片什么时候能在流媒体看**，以及**什么时候已经有可下资源**。

## 核心使命与三站联动
1. **银幕新讯（news）**：哨兵 —— 官宣流媒体定档日；资源一出就发站内通知（可直达片库）。
2. **电影导赏（guide）**：选片参谋 —— 无剧透背景、风格与大纲。
3. **电影片库（movie）**：资源下载 —— 夸克/百度/迅雷等网盘秒存（登录后可见链接）。

---

## 硬上限
- **每个自然日最多 3 条**精选卡片，宁缺毋滥（无每日下限）。
- 代码兜底：`src/lib/data.ts` 的 `capPerDay()` / `MAX_EVENTS_PER_DAY = 3`。
- 同一天排序优先级（`eventPriority()`）：
  **出资源通知 > 流媒体已上线/熟肉上线 > 流媒体官宣定档（有确切日期）**。
- **时间线完全不进影展/奖项/入围/提名**（影片档案页可保留历史奖讯字段，但不进首页时间线）。

---

## 只收（KEEP）——两大主轴

### 1. 新片流媒体定档（主轴 A）
- 官方或权威行业媒体公布的确切流媒体上线日期 + 平台（Netflix / Apple TV+ / Max / Prime / Criterion Channel / MUBI / Disney+ / 国内正版平台等）。
- 必须有 `YYYY-MM-DD`；未定档、TBA、空头支票不进时间线（可留在影片页写「尚未公布」）。
- 地区必填：美国区日期只写美国，不得当全球；When To Stream / JustWatch 须用平台官方月单或 Variety、Deadline、The Wrap 二次核对。
- 来源必填：写入 `streaming[].source`；没有可核来源的不落站。
- 选片：作者向 / 制作好的新片与焦点文艺片；**不收**纯商业爆米花与超级英雄连载。获奖不是必要条件。
- **未来定档**（日期尚未到）以 badge「定档」进时间线；**已到日**以 badge「已上线」进时间线。

### 2. 新片已经出资源 → 站内通知（主轴 B）
- 下列任一成立即可发一条时间线通知（每片「首次出资源」只记一次，重大画质升级可再记一次）：
  - 高质量中字压制释出（WEB-DL / BDRip / 官方数字版等），国内影迷可实际获取；
  - **电影片库**（movie.readcine.com）该片已有可存网盘资源。
- 卡片须带片名、资源形态简述，并链到片库「找资源」。
- **本阶段通知通道仅站内时间线**（外推邮件/IM 归 P1）。
- 不编造「已出货」；无可靠来源或片库未入库则不发。
- 资讯站**不展示**网盘明文 URL / 提取码（由 movie 登录分流处理）。

### 特例（仍算主轴 A）
- 经典神作首次 4K 修复 / CC 修复上线流媒体。

---

## 不收（DROP）
- ❌ **一切影展/奖项/入围/提名刷屏**（含三大节最高主奖、奥斯卡等；时间线一律不进）。
- ❌ **纪录片**（含「纪录」类目、documentary / docuseries / 档案纪录片）；时间线只收电影长片。
- ❌ **剧集**（电视剧 / 迷你剧 / 限定剧 / TV series / miniseries）；时间线只收电影。
- ❌ 纯国外线下院线点映/开画（国内看不到）。
- ❌ 小型影展、副奖、观众奖、技术支线、影评人协会奖、WIP/创投。
- ❌ 纯公关式分数波动、票房、宣发炒作、映后掌声；口碑首跨默认不进时间线。
- ❌ 未定档的空头支票（开机、选角传闻、无日期 TBA）。
- ❌ 无中字、无法获取的「资源」传闻。
- ❌ 卡片副标题 / meta 列表与主标题信息重复（平台、日期、地区等只留一处）。

---

## 数据落点
- 流媒体定档 / 上线 → `streaming` 字段，以及 `density-pack.json` / `auteur-news.json` / `wts-streaming-catalog.json` / `won-streaming-catalog.json` / `motn-streaming-catalog.json`
- 自动定档源（2026-11-05）：
  - **When To Stream**：远窗 PVOD / 数字版；`scripts` 侧由 Muse 定时或一次性抓取 → `wts-streaming-catalog.json`
  - **What's on Netflix**：美区 Netflix 近窗日历（公开 JSON-LD）；复跑 `python3 scripts/fetch_whatson_netflix.py` → `won-streaming-catalog.json`；与 WTS/MotN 按同平台同日去重，不清理其它平台远窗
  - **Movie of the Night（Streaming Availability API）**：美区近 ~31 天 Netflix/Disney+/Prime/Apple/Max/Mubi upcoming；复跑 `MOTN_API_KEY=… python3 scripts/fetch_motn_upcoming.py` → `motn-streaming-catalog.json`；不覆盖已有同平台 announced 日期
- 时间线定档卡展示来源标签：由 `streaming[].sourceLabel` 或 `source` URL host 推导（When To Stream / What's on Netflix / Movie of the Night）；编辑种子无 source 时可不显示
- 出资源通知 → `auteur-news.json`（摘要含「出资源/熟肉/网盘可下」等可识别词，便于 badge 与优先级）
- 奖项 JSON 可保留作影片档案参考，**不得**再进入 `getTimelineEvents()` 时间线
- 不得只改 `film-copy.json`（不含 streaming，改了无效）

---

## 流媒体字段规则（沿用并收紧）
- 只写官方已公布的确切日期 + 平台；未公布写「尚未公布」，不编造。
- `announced` 必须有 `YYYY-MM-DD`；`tba` / `estimated` 不得带日期。
- 平台须在 `src/types/index.ts` 枚举内；`region` 为字符串，不用旧 `regions` 数组。
- 影片页：有日期在上、由近到远；无日期在下。
