"use client";

import type { TimelineEvent, TimelineEventType } from "@/types";

export const DISMISS_STORAGE_KEY = "news_dismiss_marks_v1";
export const DISMISS_EVENT_NAME = "news_dismiss_updated";

export interface DismissMark {
  at: number;
  type: TimelineEventType;
  filmId?: string;
  headline?: string;
  summary?: string;
  /** 用户亲手写的不再推荐原因，后续作选稿提示词/规则的输入。 */
  reason?: string;
}

export interface DismissStore {
  blocked: Record<string, DismissMark>;
}

/**
 * 标准化文本：转小写，去除标点、符号及多余空白字符
 */
export function normalizeForDice(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

/**
 * 提取字符 bigrams（2-gram）
 */
export function extractBigrams(str: string): Set<string> {
  const clean = normalizeForDice(str);
  const set = new Set<string>();
  if (clean.length === 0) return set;
  if (clean.length === 1) {
    set.add(clean);
    return set;
  }
  for (let i = 0; i < clean.length - 1; i++) {
    set.add(clean.slice(i, i + 2));
  }
  return set;
}

/**
 * 计算 Dice(bigram) 系数：2 * |A ∩ B| / (|A| + |B|)
 */
export function diceCoefficient(a: string, b: string): number {
  const na = normalizeForDice(a);
  const nb = normalizeForDice(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // 包含关系兜底：长子串高重叠判定
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    if (ratio >= 0.7) {
      return Math.max(0.7, ratio);
    }
  }

  const setA = extractBigrams(na);
  const setB = extractBigrams(nb);
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const bg of setA) {
    if (setB.has(bg)) intersection++;
  }

  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * 定档/上线类标题尾部的套话（日期、平台、状态词），跨片比对前去掉：
 *   《潜伏6》 · 11月21日上线 / 《懦夫》 · 11月10日已上线 / 《奥德赛》已上线
 *   《X》窗口待定 / 《X》预计11月21日 / Madden · Streaming Nov 18
 *   The Odyssey · Streaming since Nov 9 / The Odyssey is out now
 * 只去尾部套话，不动片名本身；循环去，直到稳定。
 */
const SCHEDULE_SUFFIX_RES: RegExp[] = [
  // " · 11月21日上线" / " · Nov 18" / " · Streaming Nov 18" / " · TBA" / " · Expected Nov 18"
  /\s*[·•]\s*(?:\d{1,2}月\d{1,2}日|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}|Streaming\b|Expected\b|TBA\b|上线|已上线|定档|出源|窗口待定).*$/iu,
  // 尾部状态词："已上线" / "上线" / "窗口待定" / "预计11月21日" / "定档11月21日"
  /\s*(?:已上线|上线|窗口待定|预计.*|定档.*)$/u,
  // 尾部英文状态：" is out now" / " out now" / " streaming ..."
  /\s+(?:is\s+out\s+now|out\s+now|streaming\b.*)$/i,
];

export function stripScheduleSuffix(title: string): string {
  let s = (title || "").trim();
  for (let i = 0; i < 4; i++) {
    const next = SCHEDULE_SUFFIX_RES.reduce((acc, re) => acc.replace(re, ""), s).trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** 跨片比对用的标题键：去套话后缀后规范化（小写、去标点空白）。 */
export function strippedTitleKey(title: string): string {
  return normalizeForDice(stripScheduleSuffix(title));
}

/**
 * 类似判定（隐藏本条 + 类似）：
 * 1. 同 filmId（优先全藏该片相关时间线条）
 * 2. Dice 相似只在同 filmId 内生效（两侧都没有 filmId 的奖讯/评审类也按
 *    同片处理，见 NOTES_dismiss.md 规则 4）：同 type 且标题 Dice ≥ 0.45，
 *    或标题/summary Dice ≥ 0.55
 * 3. filmId 不同时 Dice 不生效——「《A》 · 11月N日上线」这类套话标题的
 *    Dice 会跨片误判；跨片只认去掉日期/套话后缀后完全相同的标题
 *    （例如别名片的两条「已上线」）。
 */
export function isSimilarMark(event: TimelineEvent, mark: DismissMark): boolean {
  if (!event || !mark) return false;

  // 1. 同 filmId（有则优先全藏该片相关时间线条）
  if (event.filmId && mark.filmId && event.filmId === mark.filmId) {
    return true;
  }

  const eventTitle = event.headline || event.filmTitle || "";
  const markTitle = mark.headline || "";
  // Dice 只在同 filmId 内生效；两侧都没有 filmId 时也按同片处理。
  const sameFilm = event.filmId === mark.filmId;
  if (sameFilm) {
    const titleDice = diceCoefficient(eventTitle, markTitle);

    // 2. 同 type 且标题/headline Dice(bigram) ≥ 0.45
    if (event.type === mark.type && titleDice >= 0.45) {
      return true;
    }

    // 3. 或 headline/summary Dice ≥ 0.55
    if (titleDice >= 0.55) {
      return true;
    }

    const eventSummary = event.summary || "";
    const markSummary = mark.summary || "";
    if (eventSummary && markSummary) {
      if (diceCoefficient(eventSummary, markSummary) >= 0.55) {
        return true;
      }
      if (
        diceCoefficient(eventTitle, markSummary) >= 0.55 ||
        diceCoefficient(eventSummary, markTitle) >= 0.55
      ) {
        return true;
      }
    }
    return false;
  }

  // 跨片：只认去掉日期/套话后缀后完全相同的标题。
  const eventKey = strippedTitleKey(eventTitle);
  if (!eventKey) return false;
  return eventKey === strippedTitleKey(markTitle);
}

/**
 * 从 localStorage 加载屏蔽记录
 */
export function loadDismissMarks(): DismissStore {
  if (typeof window === "undefined") {
    return { blocked: {} };
  }
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return { blocked: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.blocked === "object" && parsed.blocked !== null) {
      return { blocked: parsed.blocked };
    }
    return { blocked: {} };
  } catch {
    return { blocked: {} };
  }
}

/**
 * 保存屏蔽记录至 localStorage 并广播自定义事件
 */
export function saveDismissMarks(store: DismissStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(DISMISS_EVENT_NAME, { detail: store }));
  } catch {
    // 忽略存储超限等异常
  }
}

/**
 * 判断事件是否被直接屏蔽或因相似规则被屏蔽
 */
export function isBlockedOrSimilar(event: TimelineEvent, store: DismissStore): boolean {
  if (!store || !store.blocked) return false;
  if (store.blocked[event.id]) return true;

  for (const mark of Object.values(store.blocked)) {
    if (isSimilarMark(event, mark)) {
      return true;
    }
  }
  return false;
}

/**
 * 本机撤销记录（tombstone）：用户在本机亲手撤销过的屏蔽 id。
 * 云端还留着这些记录时，首页合并不得把它们盖回来——本机撤销优先于云端。
 * 重新屏蔽某条时从这里删掉；一键清除时保留（清除本身就是一次明确撤销）。
 */
export const DISMISS_UNBLOCKED_KEY = "news_dismiss_unblocked_v1";
const UNBLOCKED_CAP = 500;

export function loadUnblockedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DISMISS_UNBLOCKED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function saveUnblockedIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_UNBLOCKED_KEY, JSON.stringify(ids.slice(-UNBLOCKED_CAP)));
  } catch {
    // 忽略存储异常；最坏情况是下次合并时云端记录重新出现。
  }
}

export function recordUnblockedIds(ids: string[]): void {
  if (ids.length === 0) return;
  const merged = [...loadUnblockedIds()];
  for (const id of ids) {
    if (!merged.includes(id)) merged.push(id);
  }
  saveUnblockedIds(merged);
}

export function clearUnblockedIds(ids: string[]): void {
  if (ids.length === 0) return;
  const remove = new Set(ids);
  saveUnblockedIds(loadUnblockedIds().filter((id) => !remove.has(id)));
}

/** 云端 + 本机合并：本机优先；本机已撤销的 id 不再被云端盖回来。 */
export function mergeCloudDismiss(
  cloudBlocked: Record<string, DismissMark>,
  localBlocked: Record<string, DismissMark>,
): Record<string, DismissMark> {
  const merged = { ...(cloudBlocked || {}), ...(localBlocked || {}) };
  for (const id of loadUnblockedIds()) {
    delete merged[id];
  }
  return merged;
}

/**
 * 判断事件是否被直接记录屏蔽
 */
export function isDirectlyBlocked(eventId: string, store: DismissStore): boolean {
  if (!store || !store.blocked) return false;
  return Boolean(store.blocked[eventId]);
}

/**
 * 屏蔽某条事件并持久化
 */
export function blockEvent(event: TimelineEvent, store: DismissStore, reason?: string): DismissStore {
  const newBlocked: Record<string, DismissMark> = {
    ...store.blocked,
    [event.id]: {
      at: Date.now(),
      type: event.type,
      filmId: event.filmId,
      headline: event.headline || event.filmTitle,
      summary: event.summary,
      ...(reason ? { reason } : {}),
    },
  };
  // 重新屏蔽 = 撤销先前的本机撤销，云端合并时不再排除它。
  clearUnblockedIds([event.id]);
  const updatedStore = { blocked: newBlocked };
  saveDismissMarks(updatedStore);
  return updatedStore;
}

/**
 * 撤销对某事件的屏蔽（同时清除导致其被屏蔽的相似 mark）并持久化
 */
export function unblockEvent(event: TimelineEvent, store: DismissStore): DismissStore {
  const newBlocked: Record<string, DismissMark> = { ...store.blocked };
  const removedIds: string[] = [];
  if (newBlocked[event.id]) {
    delete newBlocked[event.id];
    removedIds.push(event.id);
  }

  // 清除导致该条目被隐藏的 mark
  for (const [id, mark] of Object.entries(newBlocked)) {
    if (isSimilarMark(event, mark)) {
      delete newBlocked[id];
      removedIds.push(id);
    }
  }
  // 记一笔本机撤销：下次云端合并回来时，这些 id 不再被盖回来。
  recordUnblockedIds(removedIds);

  const updatedStore = { blocked: newBlocked };
  saveDismissMarks(updatedStore);
  return updatedStore;
}

/**
 * 清除所有屏蔽记录
 */
export function clearDismissMarks(): DismissStore {
  const emptyStore = { blocked: {} };
  saveDismissMarks(emptyStore);
  return emptyStore;
}
