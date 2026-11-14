"use client";

/**
 * 跨站「已看」去重（news 端，2026-11-14）。
 *
 * - 只对站长本人生效：读写 https://ai.readcine.com/api/prefs/seen，身份来自
 *   prefs Bearer 会话或 .readcine.com 共享登录 Cookie（oauth2-proxy）。后端只认
 *   tonycter@gmail.com；匿名访客、爬虫、其他账号拿到 401，页面完全不变。
 * - 打开影片页 / 事件页 = 本站已看（site=news）。
 * - 在电影下载站（movie）打开过的片子，在本站列表里直接隐藏；搜索时不隐藏。
 * - 匹配：豆瓣 id，或「规范化片名 + 年份（±1 年）」。算法与 movie 端
 *   /opt/movieupdate/web/js/cross-seen.js 保持一致，改一边要同步另一边。
 */

import { useEffect, useState } from "react";
import { PREFS_API_BASE, loadPrefsSession } from "@/lib/prefs";

import {
  matchTokens,
  seenTokens,
  doubanIdFromFilmId,
  type SeenFilm,
  type SeenRecord,
} from "@/lib/crossSeenKeys";

export type { SeenFilm, SeenRecord };
export { seenTokens };

const ANON_KEY = "rc-cross-seen-anon";
const ANON_TTL_MS = 30 * 60 * 1000;
export const CROSS_SEEN_EVENT = "rc-cross-seen-updated";

function authHeaders(): Record<string, string> {
  const s = loadPrefsSession();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}

function anonCached(): boolean {
  try {
    const at = Number(sessionStorage.getItem(ANON_KEY) || 0);
    return Boolean(at) && Date.now() - at < ANON_TTL_MS && !loadPrefsSession();
  } catch {
    return false;
  }
}

let loading: Promise<Set<string> | null> | null = null;
let current: Set<string> | null = null;

/** 拉取本人已看（只取 movie 站的记录用于本站隐藏）；未登录返回 null。 */
export function loadCrossSeen(force = false): Promise<Set<string> | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (loading && !force) return loading;
  if (!force && anonCached()) return Promise.resolve(null);
  loading = fetch(`${PREFS_API_BASE}/seen`, {
    credentials: "include",
    headers: { Accept: "application/json", ...authHeaders() },
  })
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          try {
            sessionStorage.setItem(ANON_KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
        }
        return null;
      }
      const data = (await res.json()) as { seen?: SeenRecord[] };
      try {
        sessionStorage.removeItem(ANON_KEY);
      } catch {
        /* ignore */
      }
      const set = new Set<string>();
      for (const r of data.seen || []) {
        if (r.site === "news") continue;
        for (const t of matchTokens(r)) set.add(t);
      }
      current = set;
      window.dispatchEvent(new Event(CROSS_SEEN_EVENT));
      return set;
    })
    .catch(() => null);
  return loading;
}

/** React：返回 movie 站已看 token 集合；未登录 / 加载中为 null。 */
export function useCrossSeen(): Set<string> | null {
  const [set, setSet] = useState<Set<string> | null>(current);
  useEffect(() => {
    let alive = true;
    void loadCrossSeen().then((s) => {
      if (alive) setSet(s);
    });
    const onChange = () => setSet(current);
    const onSession = () => {
      void loadCrossSeen(true).then((s) => alive && setSet(s));
    };
    window.addEventListener(CROSS_SEEN_EVENT, onChange);
    window.addEventListener("prefs-session-changed", onSession);
    return () => {
      alive = false;
      window.removeEventListener(CROSS_SEEN_EVENT, onChange);
      window.removeEventListener("prefs-session-changed", onSession);
    };
  }, []);
  return set;
}

export function isCrossSeen(set: Set<string> | null, f: SeenFilm): boolean {
  if (!set || set.size === 0) return false;
  return seenTokens(f).some((t) => set.has(t));
}

const markedThisPage = new Set<string>();

/** 打开影片 / 事件页：记为本人在 news 已看。未登录时什么都不发。 */
export async function markNewsSeen(f: SeenFilm & { id: string }): Promise<void> {
  if (typeof window === "undefined" || !f.id || markedThisPage.has(f.id)) return;
  const set = await loadCrossSeen();
  if (set === null) return; // 未登录 / 非本人
  markedThisPage.add(f.id);
  try {
    await fetch(`${PREFS_API_BASE}/seen`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        site: "news",
        item_id: f.id,
        title: f.title || "",
        title_en: f.titleEn || "",
        year: f.year ? String(f.year) : "",
        douban_id: f.doubanId || doubanIdFromFilmId(f.id),
      }),
    });
  } catch {
    markedThisPage.delete(f.id);
  }
}
