# news.readcine.com · AdSense 申请准备（2026-10-24）

> 说明：下文的「门槛」均为业内/社区常见经验（common guidance），**不是 Google 官方数字**。Google 官方只要求「独特、有价值、足量的原创内容」「清晰导航」「遵守计划政策」，没有公开字数或篇数下限。

## 1. 本次已完成（代码）
- 新增 `/privacy`（隐私政策，含 localStorage 键、Google Fonts、GitHub Pages、AdSense / DoubleClick(DART) Cookie、个性化广告停用方式、数据保留、儿童、联系方式，生效日 2026-10-24）、`/about`（ReadCine 编辑部、编辑标准摘要）、`/contact`（mloder@qq.com）。
- 全站 Footer 加「关于 · 联系 · 隐私政策」与版权行。
- sitemap.xml：去掉 11 个重复的 film URL，补上全部 event 页与 3 个新页；robots.txt 由 `src/app/robots.ts` 生成（删除重复的 public/robots.txt），CNAME 保留。
- 404 页 noindex；event / film 页 description 唯一化（原先 31 组页面共用同一 description）。
- 洪常秀《无处安放的目光》重复 id 合并：主 id `nowhere-to-lay-eyes`，旧 `/film/nowhere-to-lay-my-eyes` 保留为 noindex + canonical + 跳转的别名页。

## 2. 待办：ads.txt（TODO，未创建文件）
AdSense 审核通过、拿到发布商 ID 后，新建 `public/ads.txt`，内容一行：
```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```
把 `pub-XXXXXXXXXXXXXXXX` 换成 AdSense 后台「账号 → 设置 → 账号信息」里的真实发布商 ID。**在拿到真实 ID 前不要提交任何占位文件。**

## 3. 内容审计（基于 2026-10-24 本地构建 out/）
| 项目 | 数量 / 数值 |
|---|---|
| 可索引页面（sitemap） | 189：首页 1 + 影片页 115 + 事件页 70 + 新页面 3（别名页 noindex，不计） |
| 影片页正文（含页面固定文字） | 中位约 137 字；< 150 字约 71 页；≥ 300 字约 10 页；≥ 500 字 0 页 |
| 影片简介+背景（纯编辑文字） | 中位约 66 个汉字；没有一部超过 200 个汉字 |
| 事件页正文（含页面固定文字） | 中位约 227 字；≥ 300 字约 10 页；≥ 500 字 0 页 |
| 作者新闻条目（auteur-news.json） | 15 条，每条 detail 约 45–115 个汉字 |
| 有 300–600 字原创分析的「文章」 | **0** |
| 重复 title / canonical | 仅首页与 404 共用（已修：404 noindex） |
| 重复 description | 31 组（已修） |
| 断图 / 外链图 | 0（海报均为本地 /posters） |
| 大段英文照搬（15 个以上英文词连写） | 未发现 |

**薄页 / 重复页：**
- 6 个「伪影片页」只有一句话：`honorary-clooney`、`honorary-burstyn`、`honorary-yeoh`、`honorary-hui`、`venice-jury-2026`、`busan-jury-2026-zhang-yimou`。另外 `ketticè`（约 7 字，description 与首页相同；id 带重音字符）、`were-nothing-at-all`、`age-of-goodbyes`、`arrested-memory` 也很薄。
- `nowhere-to-lay-eyes` / `nowhere-to-lay-my-eyes` 重复（已合并）。
- 同一部片的 film 页与 event 页文字高度相似（例如 imperium、possible-love、tender-loving-care）。

**原创性：** 文字是编辑部用中文改写的，并标明来源（Variety / RT / Wikipedia 等），不算抄袭。但内容以「事实 + 来源」的短讯为主，影片简介接近官方 logline 的翻译，原创观点和分析很少。这是目前最大的风险。

## 4. 对照常见经验的差距
| 常见经验（非官方） | 现状 | 差距 |
|---|---|---|
| 20–30 篇以上、每篇几百字的优质原创文章 | 0 篇达到 300 字 | **约 20–30 篇** |
| 隐私 / 关于 / 联系页 | 已补齐 | — |
| 清晰导航 | 首页时间线 + Footer | 建议加「专题」入口，放常青页 |
| 没有大量薄页 | 约 70% 的影片页不到 150 字 | 扩写，或对伪影片页 noindex |
| 稳定更新、站点有一定历史 | 每天 ≤ 3 条，持续更新 | 保持 |
| 有自然流量、已被收录 | 刚接入 GSC | 等 2–4 周收录数据 |

## 5. 3–4 周内容计划（遵守 EDITORIAL.md 每天最多 3 条）
原则：**时间线新闻**仍然每天最多 3 条，标准不变；**常青专题页和影片页扩写**不是新闻，不进时间线，不占每日名额。

**第 1 周（10/26–11/1）**
- 新闻：每条 detail 从约 80 字扩到 300–600 字，结构为「事实 / 为什么重要（导演脉络、影展位置）/ 接下来看什么」。目标 6–10 条。
- 常青：新建 `/guide/` 专题目录，先写「A 类电影节是什么：戛纳、威尼斯、柏林等 15 个 FIAPF 竞赛型影展一览」（约 1500 字），以及「金马奖历史与规则」（约 1000 字）。
- 清理：6 个伪影片页改为事件，或设为 noindex；`ketticè` 改成 ASCII id 并补足简介。

**第 2 周（11/2–11/8）**
- 新闻：同上，每条 300 字以上。
- 常青：戛纳、威尼斯、柏林各写一篇介绍（历史、主奖、近十年金棕榈 / 金狮 / 金熊得主），每篇 800–1200 字。
- 影片页扩写：给最重要的 10 部作者片（如 Possible Love、Tender Loving Care、Nowhere to Lay My Eyes 等）补 300–500 字「看点 / 导演脉络」。

**第 3 周（11/9–11/15）**
- 常青：导演片单页（洪常秀、李沧东、滨口龙介、阿尔莫多瓦、迈克·利），每页 600–1000 字，并链接到站内影片页。
- 常青：「奥斯卡国际影片奖规则与各国选送流程」「金球奖与奥斯卡的区别」。
- 再扩写 10 个影片页。

**第 4 周（11/16–11/22）**
- 常青：「2026 颁奖季时间表」（金马 11 月、金球 / 奥斯卡提名等），和「如何读烂番茄 / Metacritic 分数」。
- 自查：原创 300 字以上的页面数 ≥ 25–30，薄页 noindex 或已扩写，GSC 显示收录 ≥ 50 页且没有严重错误，然后再申请 AdSense。

预计 4 周后：常青专题约 12–15 篇，扩写的新闻约 20 篇以上，扩写的影片页约 20 页。合计 40 篇以上、300 字以上的原创页面，超过常见经验的 20–30 篇。

## 6. 需要用户本人完成
1. Google Search Console：添加资源 `https://news.readcine.com`（建议用 DNS TXT 验证，交运维加记录；也可用 HTML 标签，交给我加 meta），然后提交 `https://news.readcine.com/sitemap.xml`。
2. 内容达标后（约 4 周），用本人 Google 账号在 https://adsense.google.com 申请，网站填 `news.readcine.com`，把 AdSense 给的 `<script>` 校验代码交给我加到 layout。
3. 通过后把发布商 ID 给我，我来补 `ads.txt`，并在隐私政策中确认广告条款。
