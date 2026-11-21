"use client";

import { useEffect, useState } from "react";
import { PREFS_API_BASE, loadPrefsSession } from "@/lib/prefs";

/**
 * 影片页：站长本人登录后显示该片的网盘分享链接（2026-11-21）。
 *
 * - 链接只存在 ECS 服务端（readcine-prefs），经鉴权接口
 *   GET {PREFS_API_BASE}/quark-links?film=<filmId> 返回；不进仓库、静态产物、公开 JSON。
 * - 身份：prefs Bearer 会话或 .readcine.com 共享登录 Cookie；后端只认站长本人。
 * - 未登录 / 非授权 / 该片没有链接：组件渲染 null，DOM 中不留任何按钮、占位或提示。
 */

interface OwnerLink {
  url: string;
  code?: string;
  title?: string;
}

function safeHttps(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

export default function OwnerQuarkLinks({ filmId }: { filmId: string }) {
  const [links, setLinks] = useState<OwnerLink[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      const s = loadPrefsSession();
      fetch(`${PREFS_API_BASE}/quark-links?film=${encodeURIComponent(filmId)}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const data = (await res.json()) as { links?: OwnerLink[] };
          const ok = (data.links || [])
            .map((l) => ({ ...l, url: safeHttps(l?.url) || "" }))
            .filter((l) => l.url);
          return ok.length ? ok : null;
        })
        .catch(() => null)
        .then((v) => {
          if (alive) setLinks(v);
        });
    };
    load();
    window.addEventListener("prefs-session-changed", load);
    return () => {
      alive = false;
      window.removeEventListener("prefs-session-changed", load);
    };
  }, [filmId]);

  if (!links || links.length === 0) return null;
  return (
    <section data-owner-quark className="rounded-2xl border border-cinema-border bg-cinema-card p-4 sm:p-6">
      <h2 className="font-display text-lg text-cinema-text">夸克网盘</h2>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.url} className="break-all text-sm">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
              className="text-cinema-gold hover:underline"
            >
              {l.title ? l.title.slice(0, 80) : l.url}
            </a>
            {l.code ? (
              <span className="ml-2 text-cinema-muted">
                提取码 <span className="font-mono text-cinema-text">{l.code}</span>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
