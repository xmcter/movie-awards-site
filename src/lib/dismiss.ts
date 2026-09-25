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
 * 类似判定（隐藏本条 + 类似）：
 * 1. 同 filmId（优先全藏该片相关时间线条）
 * 2. 或同 type 且标题/headline Dice(bigram) ≥ 0.45
 * 3. 或 headline/summary Dice ≥ 0.55
 * （荣誉/评审无 filmId 时，自动由规则 2 & 3 通过 type + 标题近似判定）
 */
export function isSimilarMark(event: TimelineEvent, mark: DismissMark): boolean {
  if (!event || !mark) return false;

  // 1. 同 filmId（有则优先全藏该片相关时间线条）
  if (event.filmId && mark.filmId && event.filmId === mark.filmId) {
    return true;
  }

  const eventTitle = event.headline || event.filmTitle || "";
  const markTitle = mark.headline || "";
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
 * 判断事件是否被直接记录屏蔽
 */
export function isDirectlyBlocked(eventId: string, store: DismissStore): boolean {
  if (!store || !store.blocked) return false;
  return Boolean(store.blocked[eventId]);
}

/**
 * 屏蔽某条事件并持久化
 */
export function blockEvent(event: TimelineEvent, store: DismissStore): DismissStore {
  const newBlocked: Record<string, DismissMark> = {
    ...store.blocked,
    [event.id]: {
      at: Date.now(),
      type: event.type,
      filmId: event.filmId,
      headline: event.headline || event.filmTitle,
      summary: event.summary,
    },
  };
  const updatedStore = { blocked: newBlocked };
  saveDismissMarks(updatedStore);
  return updatedStore;
}

/**
 * 撤销对某事件的屏蔽（同时清除导致其被屏蔽的相似 mark）并持久化
 */
export function unblockEvent(event: TimelineEvent, store: DismissStore): DismissStore {
  const newBlocked: Record<string, DismissMark> = { ...store.blocked };
  delete newBlocked[event.id];

  // 清除导致该条目被隐藏的 mark
  for (const [id, mark] of Object.entries(newBlocked)) {
    if (isSimilarMark(event, mark)) {
      delete newBlocked[id];
    }
  }

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
