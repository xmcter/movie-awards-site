"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "首页" },
  { href: "/awards", label: "奖项" },
  { href: "/streaming", label: "流媒体" },
  { href: "/search", label: "搜索" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-cinema-border/80 bg-cinema-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cinema-gold/20 text-sm font-bold text-cinema-gold">
            奖
          </span>
          <span className="font-display text-lg tracking-wide text-cinema-text group-hover:text-cinema-gold-light">
            银幕奖讯
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                isActive(item.href)
                  ? "bg-cinema-elevated text-cinema-gold"
                  : "text-cinema-muted hover:text-cinema-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="rounded-lg border border-cinema-border px-3 py-1.5 text-sm text-cinema-muted md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="菜单"
        >
          {open ? "关闭" : "菜单"}
        </button>
      </div>

      {open && (
        <nav className="border-t border-cinema-border px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  isActive(item.href)
                    ? "bg-cinema-elevated text-cinema-gold"
                    : "text-cinema-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
