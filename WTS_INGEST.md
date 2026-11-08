# When To Stream 采入流程（WTS Ingest）

新闻站流媒体定档的 WTS 来源采入流程。脚本只拉取候选，入库永远经过人工（agent）复核，不自动写 catalog。

## 流程

1. **拉取候选**（脚本，不写 catalog）

   ```bash
   node scripts/fetch_wts.mjs [--pages 3] [--days 10]
   ```

   默认写仓库根目录 `wts-candidates.json`（已进 `.gitignore`，不提交）。
   源：`https://whentostream.com/wp-json/wp/v2/posts?categories=8`（Streaming-Film 分类，
   www 会 301 到 apex，fetch 跟随跳转）。分页请求间隔 ≥ 1.2s。

2. **agent 复核**（人工步骤，脚本不做）
   - 逐条看 candidates：标题、平台、日期、状态是否为 confirmed、是否为单片（排除合集/周报/预告）。
   - 中文标题翻译、中文简介（一句话）、导演/年份核对。
   - 新片进 `src/data/wts-streaming-catalog.json`；已在库的片（`update-existing`）把新
     streaming 条目追加到该片所在的文件里，不新建条目。
   - 每条 streaming 必须带 `source`：该 WTS 帖子的完整链接（`https://whentostream.com/...`）。
     source 字段就是手工行与脚本行的区分标记，不另加字段。

3. **校验**

   ```bash
   npm run validate
   ```

   M-N8 检查：`wts-streaming-catalog.json` 里的每条 streaming 必须带
   `whentostream.com` 来源链接，否则 error。M-N20 检查同片同平台多条 announced
   日期是否冲突。

4. **构建**

   ```bash
   npm run build
   ```

5. **提交推送**：按当时规则走批量推送（每日中午一批；用户说“现在推”立即推）。

## 采入规则（2026-11-05 首批实测核对）

- **仅 confirmed**：正文含 `neither announced nor confirmed`，或
  `According to our sources` + `expected`，即 rumor，排除。
- **排除**：纪录片（标题/正文含 documentary）、剧集（title 含 series / season）、
  合集/预告/周报（New Release Tuesday / What's Streaming This Week /
  Weekly Tracking / Preview / Trailer）。
- **单片确认帖标题形如**：`X Sets ... Streaming Release/Premiere Date` /
  `X Gets ...` / `... Confirms PVOD Date for X`。
- **平台映射**到 `src/types/index.ts` 的 StreamingPlatform 枚举，无对应值用 `other`。
- **去重键**：platform + date + announced；同片同源已入库即跳过；
  同片新平台/新日期标 `update-existing`。
- **质量闸不动**：`shouldAdmitStreaming` ≥ 25 分，入库时已过滤；推送取目录
  （streaming catalog + peek），不取首页时间线。

## 定时

cron `muse-news-sources-scheduled-scrape` 每 12 小时（09:58 / 21:58 CST）跑采入，
运行记录在 `goals/readcine/hidden_files/wts-ingest/run-log.md`。
首批上线 SHA b336de2（2026-11-05）。

## 相关脚本

- `scripts/fetch_wts.mjs` — WTS 拉取（本流程）。
- `scripts/fetch_whatson_netflix.py` — WON（What's On Netflix）拉取。
- `~/workspace/goals/readcine/hidden_files/wts-ingest/backfill-posters.mjs` — TMDB 海报补齐（在仓库外）。
