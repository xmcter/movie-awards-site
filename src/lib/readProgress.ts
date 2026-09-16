"use client";

const LS_CLICKED = "news-readcine:clicked";
const LS_LAST = "news-readcine:lastId";
const LS_SCROLL = "news-readcine:listScroll";
const MAX = 400;

export function readClicked(): string[] {
  try {
    const raw = localStorage.getItem(LS_CLICKED);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function isClicked(id: string): boolean {
  if (!id) return false;
  return readClicked().includes(id);
}

export function markClicked(id: string) {
  if (!id) return;
  let arr = readClicked().filter((x) => x !== id);
  arr.unshift(id);
  if (arr.length > MAX) arr = arr.slice(0, MAX);
  try {
    localStorage.setItem(LS_CLICKED, JSON.stringify(arr));
    localStorage.setItem(LS_LAST, id);
  } catch {
    /* ignore quota */
  }
}

export function readLastId(): string {
  try {
    return localStorage.getItem(LS_LAST) || "";
  } catch {
    return "";
  }
}

export function saveScroll(y: number) {
  try {
    localStorage.setItem(LS_SCROLL, String(Math.max(0, Math.round(y || 0))));
  } catch {
    /* ignore */
  }
}

export function readScroll(): number {
  try {
    const n = parseInt(localStorage.getItem(LS_SCROLL) || "0", 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}
