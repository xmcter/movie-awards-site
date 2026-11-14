"use client";

import { useEffect } from "react";
import { markNewsSeen, useCrossSeen, type SeenFilm } from "@/lib/crossSeen";

/**
 * 全站：把「电影下载站已看」的片子在静态列表里隐藏（带 data-rc-fk 的元素，
 * 如 /films）。时间线另在 Timeline 里按同一集合过滤。匿名访客不注入任何样式。
 */
export function CrossSeenStyle() {
  const set = useCrossSeen();
  useEffect(() => {
    const id = "rc-cross-seen-style";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!set || set.size === 0) {
      if (el) el.textContent = "";
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    const sel = Array.from(set)
      .map((t) => `[data-rc-fk~="${t.replace(/["\\]/g, "")}"]`)
      .join(",\n");
    el.textContent = `${sel}{display:none!important}`;
  }, [set]);
  return null;
}

/** 影片页 / 事件页挂一个：打开即记为本人已看。 */
export function SeenMark({ film }: { film: SeenFilm & { id: string } }) {
  useEffect(() => {
    void markNewsSeen(film);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.id]);
  return null;
}
