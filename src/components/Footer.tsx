"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isEnPath } from "@/lib/i18n";

export default function Footer() {
  const pathname = usePathname();
  const en = isEnPath(pathname);
  const prefix = en ? "/en" : "";

  return (
    <footer className="mt-16 border-t border-cinema-border bg-cinema-card">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="font-display text-cinema-text">{en ? "Screen News" : "银幕新讯"}</p>
        <p className="mt-1 text-sm text-cinema-muted">
          {en
            ? "New film streaming dates · new film updates"
            : "新片流媒体定档 · 新片发行动态"}
        </p>
        <p className="mt-3 text-xs text-cinema-muted/70">
          <Link
            href={`${prefix}/insight/not-only-scores`}
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-accent"
          >
            {en ? "Original" : "本站原创"}
          </Link>
          <span className="mx-2 opacity-40">·</span>
          <Link
            href={`${prefix}/films`}
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-accent"
          >
            {en ? "All films" : "全部影片"}
          </Link>
          <span className="mx-2 opacity-40">·</span>
          <Link
            href={`${prefix}/privacy`}
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-accent"
          >
            {en ? "Privacy" : "隐私政策"}
          </Link>
        </p>
        <p className="mt-2 text-xs text-cinema-muted/70">
          <a
            href="https://readcine.com"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-accent"
          >
            readcine {en ? "nav" : "导航"}
          </a>
          <span className="mx-2 opacity-40">·</span>
          <a
            href="https://news.readcine.com"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-accent"
          >
            news.readcine.com
          </a>
        </p>
        {/* 新内容推送开关：由 readcine.com/shared/rc-push.js 挂载，仅本人登录时显示 */}
        <div data-rc-push="" className="text-cinema-muted" />
        <p className="mt-2 text-xs text-cinema-muted/70">
          © 2026 ReadCine {en ? "Editors" : "编辑部"}
        </p>
      </div>
    </footer>
  );
}
