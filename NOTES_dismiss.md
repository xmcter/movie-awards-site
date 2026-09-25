# NOTES — 「不再推荐」个性化屏蔽（对齐 AI 站语义，无「感兴趣」）

日期：2026-09-25（UTC+8）  
站点：https://news.readcine.com（GitHub Pages 静态导出，自定义域 `news.readcine.com`）  
代码仓库：`/workspace/movie-awards-site`（GitHub `xmcter/movie-awards-site`，分支 `main`）  
参考交互：`/workspace/ai-agent-updates`（`NOTES_interest_marks.md`，v=15）

---

## 一句话概述
时间线及事件详情页每条均可点击「不再推荐」：本条隐藏 + 类似条目隐藏；持久化至 `localStorage`；支持撤销与一键清除；**不设**「感兴趣」或加权推荐。

---

## 行为与交互
1. **时间线卡片**
   - 卡片操作区右下角提供「✕ 不再推荐」按钮。
   - 点击时调用 `stopPropagation()` 与 `preventDefault()`，确保不触发 Link 跳转。
   - 屏蔽后即时隐藏；若开启「查看已屏蔽」，卡片展示为已屏蔽样式并切换为「↩ 撤销屏蔽」。
   - 点击不再推荐后，列表上方提供即时撤销提示栏「已屏蔽「...」及类似条目 [↩ 撤销]」。
2. **事件详情页（`/event/[id]`）**
   - 顶部导航栏右侧提供 `EventDismissButton` 客户端组件。
   - 未屏蔽态显示「✕ 不再推荐」，已屏蔽/命中类似态显示「↩ 撤销屏蔽」。
3. **筛选区与清除控制**
   - 顶部分类按钮旁：当有屏蔽条目时，动态展示「已屏蔽 N 条 · 查看 · 清除不再推荐」。
   - 点击「清除不再推荐」一键清空屏蔽记录，所有隐藏条目立即恢复。
4. **上次阅读条（ResumeBar）**
   - 同步感知屏蔽状态，被屏蔽的内容不作为「上次看到」或「下一篇推荐」。

---

## 存储规范
- **localStorage Key**：`news_dismiss_marks_v1`
- **数据结构**：
  ```json
  {
    "blocked": {
      "<eventId>": {
        "at": 1727270000000,
        "type": "auteur",
        "filmId": "film-id",
        "headline": "新闻标题",
        "summary": "消息摘要"
      }
    }
  }
  ```
  *(仅使用 `blocked`，无 `liked`，不搞复杂推荐)*

---

## 类似判定规则（相似度与同片隐藏）
命中以下任一条件即判定为类似条目并执行屏蔽：
1. **同 `filmId`**（有 filmId 时优先全藏该片相关的入围、获奖、流媒体、新片等时间线条目）；
2. **同 `type` 且 标题/headline Dice(bigram) ≥ 0.45**；
3. **或 标题/summary Dice(bigram) ≥ 0.55**；
4. **荣誉/评审类条目（无 filmId）**：通过规则 2 与规则 3 由 type + 标题近似自动覆盖。

---

## 过滤顺序
严格遵循：
`现有 type 筛选 / 搜索` → `不再推荐过滤（隐藏本条 + 类似）` → `置顶与排序` → `渲染`。

---

## 样式设计
- 严格遵循站点现有 cinema 主题：圆角药丸按钮（`rounded-full`）、深色半透明背景与细边框（`border-cinema-border`）、金强调（`text-cinema-gold`）。
- 苹果风留白与层级设计，按钮精巧清晰，不喧宾夺主。

---

## 验收核对
1. 强制刷新线上站点：时间线卡片右下角可见「✕ 不再推荐」按钮。
2. 点击一条后该条目立即消失，同片或高相似条目同步隐藏；刷新后依然保持隐藏。
3. 点击「撤销」或「清除不再推荐」后，被屏蔽条目完整恢复。
4. 全站无任何「感兴趣」按钮或复杂加权排序算法。
5. 自动化构建与测试：`npm run lint`、`npm run validate`、`node scripts/test-dismiss.mjs` 及 `npm run build` 全部 100% 通过。
6. GitHub Pages 自动部署：push 到 `main` 分支触发 GitHub Actions 工作流。
7. （注：ECS rsync 部署备用脚本保留在 `deploy/deploy.sh`，线上以 GitHub Pages 为主）。
