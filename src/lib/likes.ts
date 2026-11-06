"use client";

import type { TimelineEvent } from "@/types";

export const LIKE_STORAGE_KEY = "news_like_marks_v1";
export const LIKE_EVENT_NAME = "news_likes_updated";

export interface LikeMark {
  at: number;
  type?: TimelineEvent["type"];
  filmId?: string;
  headline?: string;
  summary?: string;
}

export type LikeStore = Record<string, LikeMark>;

export function loadLikeMarks(): LikeStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LIKE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // Accept either { liked: {...} } or a flat id→mark map.
      if (parsed.liked && typeof parsed.liked === "object") {
        return parsed.liked as LikeStore;
      }
      return parsed as LikeStore;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveLikeMarks(liked: LikeStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify({ liked }));
    window.dispatchEvent(new CustomEvent(LIKE_EVENT_NAME, { detail: liked }));
  } catch {
    // ignore quota / private mode
  }
}

export function likeMarkFromEvent(event: TimelineEvent): LikeMark {
  return {
    at: Date.now(),
    type: event.type,
    filmId: event.filmId,
    headline: event.headline || event.filmTitle,
    summary: event.summary,
  };
}

/** Toggle like for one event; returns the next store. */
export function toggleLikeEvent(event: TimelineEvent, store: LikeStore): LikeStore {
  const next: LikeStore = { ...store };
  if (next[event.id]) delete next[event.id];
  else next[event.id] = likeMarkFromEvent(event);
  saveLikeMarks(next);
  return next;
}

export function setLikeMarks(liked: LikeStore): LikeStore {
  saveLikeMarks(liked);
  return liked;
}
