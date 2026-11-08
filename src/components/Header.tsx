"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isEnPath, toEnPath, toZhPath } from "@/lib/i18n";

export default function Header() {
  const pathname = usePathname();
  const en = isEnPath(pathname);
  const toggleHref = en ? toZhPath(pathname || "/en") : toEnPath(pathname || "/");
  const homeHref = en ? "/en" : "/";
  const comingSoonHref = en ? "/en/coming-soon" : "/coming-soon";
  const aboutHref = en ? "/en/about" : "/about";

  return (
    <header className="sticky top-0 z-50 border-b border-cinema-border/80 bg-cinema-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={homeHref} className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cinema-gold/20 text-sm font-bold text-cinema-gold">
            {en ? "S" : "银"}
          </span>
          <span className="font-display text-lg tracking-wide text-cinema-text group-hover:text-cinema-gold-light">
            {en ? "Screen News" : "银幕新讯"}
          </span>
          <span className="hidden rounded-full border border-cinema-gold/30 bg-cinema-gold/10 px-2 py-0.5 text-[10px] font-medium text-cinema-gold sm:inline-block">
            {en ? "Release dates · new films" : "定档 · 发行动态"}
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href={comingSoonHref}
            className="text-xs tracking-wider text-cinema-muted hover:text-cinema-gold"
          >
            {en ? "Coming soon" : "即将上线"}
          </Link>
          <Link
            href={aboutHref}
            className="text-xs tracking-wider text-cinema-muted hover:text-cinema-gold"
          >
            {en ? "About" : "关于"}
          </Link>
          <Link
            href={toggleHref}
            className="rounded-full border border-cinema-border/70 px-2 py-0.5 text-xs font-medium text-cinema-muted hover:border-cinema-gold/40 hover:text-cinema-gold"
            aria-label={en ? "切换到中文" : "Switch to English"}
          >
            {en ? "中文" : "EN"}
          </Link>
          <a
            href="https://readcine.com"
            className="text-xs tracking-wider text-cinema-muted hover:text-cinema-gold"
          >
            readcine.
          </a>
        </nav>
      </div>
    </header>
  );
}
