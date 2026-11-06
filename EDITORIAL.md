# news.readcine.com 编辑标准（2026-11-05：流媒体定档 · 出资源通知）

站点定位：从「影展/奖项时间线」收敛为**「流媒体定档 · 出资源通知」**。只告诉影迷两件事——**这部新片什么时候能在流媒体看**，以及**什么时候已经有可下资源**。

## 核心使命与三站联动
1. **银幕新讯（news）**：哨兵 —— 官宣流媒体定档日；资源一出就发站内通知（保留微博原帖，不展示资源获取入口）。
2. **电影导赏（guide）**：选片参谋 —— 无剧透背景、风格与大纲。
3. **电影片库（movie）**：资源下载 —— 夸克/百度/迅雷等网盘秒存（登录后可见链接）。

---

## 硬上限
- **不再设每日条数上限**。时间线按 `publishedAt` / `sourcePublishedAt` 倒序；质量闸（口水定档硬过滤、作者/获奖/MUBI 优先）在入库时完成，**绝不用定档/上映日分桶**。
- 代码：`src/lib/data.ts` 的 `shouldAdmitStreaming()` / `streamingQualityScore()`；`MAX_EVENTS_PER_DAY` 已取消硬限制。
- 同一天排序优先级（`eventPriority()`）：
  **出资源通知 > 作者/获奖向定档与已上线 > 其余定档**；口水流媒体在 `shouldAdmitStreaming()` 硬过滤。
- **时间线完全不进影展/奖项/入围/提名卡片**（影片档案页可保留历史奖讯字段；有奖项/作者线索的**定档**可优先展示）。

---

## 只收（KEEP）——两大主轴

### 1. 新片流媒体定档（主轴 A）
- 官方或权威行业媒体公布的确切流媒体上线日期 + 平台（Netflix / Apple TV+ / Max / Prime / Criterion Channel / MUBI / Disney+ / 国内正版平台等）。
- 必须有 `YYYY-MM-DD`；未定档、TBA、空头支票不进时间线（可留在影片页写「尚未公布」）。
- 地区必填：美国区日期只写美国，不得当全球；When To Stream / JustWatch 须用平台官方月单或 Variety、Deadline、The Wrap 二次核对。
- 来源必填：写入 `streaming[].source`；没有可核来源的不落站。
- 选片：**作者向 / 获奖或三大节线索 / MUBI 等精品平台**优先；`streamingQualityScore` 负分或未达阈值的口水定档（节日片、无导演流水线、纯商业凑数）**不进主列表**（仍可留在影片档）。获奖不是唯一条件，但是强加分。
- **未来定档**（日期尚未到）以 badge「定档」进时间线；**已到日**以 badge「已上线」进时间线。

### 2. 新片已经出资源 → 站内通知（主轴 B）
- 下列任一成立即可发一条时间线通知（每片「首次出资源」只记一次，重大画质升级可再记一次）：
  - 高质量中字压制释出（WEB-DL / BDRip / 官方数字版等），国内影迷可实际获取；
  - **电影片库**（movie.readcine.com）该片已有可存网盘资源。
- 卡片须带片名、资源形态简述；有可核微博原帖时附微博入口。资讯站不展示「找资源」或片库资源跳转，也不提供登录入口或登录解锁提示；资源获取只由片库自身登录后处理。
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
- 时间线定档卡展示来源标签（中文优先）：由 `streaming[].sourceLabel` 或 `source` URL host 推导（定档追踪 / Netflix上新日历 / 片夜定档 / 片库·微博）；卡片显示为「来源·站名 · 原文/收录时间」
- 出资源通知 → `auteur-news.json`（摘要含「出资源/熟肉/网盘可下」等可识别词，便于 badge 与优先级）
- 奖项 JSON 可保留作影片档案参考，**不得**再进入 `getTimelineEvents()` 时间线
- 不得只改 `film-copy.json`（不含 streaming，改了无效）

---

## 流媒体字段规则（沿用并收紧）
- 只写官方已公布的确切日期 + 平台；未公布写「尚未公布」，不编造。
- `announced` 必须有 `YYYY-MM-DD`；`tba` / `estimated` 不得带日期。
- 平台须在 `src/types/index.ts` 枚举内；`region` 为字符串，不用旧 `regions` 数组。
- 影片页：有日期在上、由近到远；无日期在下。


## 片库 peek 资源稿源（2026-11-06）
- `python3 scripts/ingest_movie_peek_resources.py --dry-run` 预览；去掉 `--dry-run` 才写数据。
- 使用已配置 SSH 身份读取服务器 localhost `/api/peek` → `/api/movie_detail`，不经过公开 OAuth API，也不在仓库保存密钥。
- 导入目录：`src/data/movie-peek-catalog.json`；通知：`auteur-news.json`，每个 `filmId` 的首次出资源去重；已有通知缺微博时可补入口。
- 使用片库 `posted_at`（Asia/Shanghai）作为消息日期，默认只处理当天；补跑可指定 `--date YYYY-MM-DD`。默认新片窗口为消息年份及前一年。
- 仅接收可核影片身份/年份/类型、有效资源及微博原帖；英字专帖、纪录片/剧集、无法识别的资源简称、无已核升级证据的旧片留待人工审稿，不猜片名/年份/中字。
- 只存影片元信息、资源形态概述及 HTTPS 微博原帖；不导入网盘 URL、提取码或原帖全文。微博入口位于首页、影片页和事件页，保留影片档案与导赏链接；资讯站始终不展示资源获取或登录入口。
- 保留每自然日 3 条精选上限；不因采集条数增加而改变编辑优先级。离线回归：`python3 scripts/test_movie_peek_resources.py`。
- 这里只交付可复跑脚本；尚未配置定时采集。GitHub Pages 的现有定时任务仅重建，不会 SSH 抓取新资源。

## 时间线发布时间与排序（2026-11-06）
- 内容按首次发布/入库的 `publishedAt` 倒序；有 `sourcePublishedAt`（源站原文时间）时优先用它排序与展示。旧作者短讯缺精确时间时使用 `auteur-news.date` 的上海发布日。平台 `streaming.date` 只描述上线安排，绝不作为列表排序或主列表日期展示。
- 列表不展示定档日；改为在来源芯片旁展示「原文 M月D日」或仅有入库戳时的「收录 M月D日」。具体平台上线日仍在影片档案查阅。
- 存量流媒体 `publishedAt` 由 Git 中该 filmId/platform/date 首次出现的提交时间回填，不拿定档日或本次构建日冒充；peek 用片库 `posted_at` 写入 `sourcePublishedAt`；WON/MotN 新稿在采集时记录上海时间，重跑不刷新旧稿时间。人工或 WTS 入库必须同时写入首次入库时间，校验会拦截缺值。
- 精选完成后再严格按发布时间排序，不再把资源类型固定置顶。

## 来源与原文时间（2026-11-06）
- 卡片必显可读来源名（中文优先）：片夜定档 / Netflix上新日历 / 定档追踪 / 片库·微博 / 好莱坞报道 等；不堆英文长 URL。
- peek 出资源：`sourceLabel=片库·微博`，`source`/`weiboUrl` 为微博原帖，`sourcePublishedAt`=片库 `posted_at`。
