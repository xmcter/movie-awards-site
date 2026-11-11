"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isEnPath, toEnPath, toZhPath } from "@/lib/i18n";
import {
  clearPrefsSession,
  googleSignIn,
  loadPrefsSession,
  type PrefsSession,
} from "@/lib/prefs";

/**
 * Owner sign-in (Google). Sources are only shown while signed in, and the
 * session persists in localStorage for 30 days. Click again to sign out.
 * The backend only allows tonycter@gmail.com.
 */
function LoginButton({ en }: { en: boolean }) {
  const [session, setSession] = useState<PrefsSession | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSession(loadPrefsSession());
    const onChange = () => setSession(loadPrefsSession());
    window.addEventListener("prefs-session-changed", onChange);
    return () => window.removeEventListener("prefs-session-changed", onChange);
  }, []);
  const signIn = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await googleSignIn();
      setSession(loadPrefsSession());
      window.dispatchEvent(new Event("prefs-session-changed"));
    } catch {
      /* 登录失败/取消/非允许账号：保持未登录，不弹额外提示。 */
    } finally {
      setBusy(false);
    }
  }, [busy]);
  const signOut = useCallback(() => {
    clearPrefsSession();
    setSession(null);
    window.dispatchEvent(new Event("prefs-session-changed"));
  }, []);
  if (session) {
    return (
      <button
        type="button"
        onClick={signOut}
        className="rounded-full border border-cinema-border/70 px-2 py-0.5 text-xs font-medium text-cinema-muted hover:border-cinema-accent/40 hover:text-cinema-accent"
        title={`${session.email} · ${en ? "click to sign out" : "点击退出登录"}`}
      >
        {en ? "Signed in" : "已登录"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={signIn}
      disabled={busy}
      className="rounded-full border border-cinema-border/70 px-2 py-0.5 text-xs font-medium text-cinema-muted hover:border-cinema-accent/40 hover:text-cinema-accent disabled:opacity-50"
    >
      {en ? "Sign in" : "登录"}
    </button>
  );
}

export default function Header() {
  const pathname = usePathname();
  const en = isEnPath(pathname);
  const toggleHref = en ? toZhPath(pathname || "/en") : toEnPath(pathname || "/");
  const homeHref = en ? "/en" : "/";
  const comingSoonHref = en ? "/en/coming-soon" : "/coming-soon";

  return (
    <header className="sticky top-0 z-50 border-b border-cinema-border/80 bg-cinema-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={homeHref} className="group flex items-center gap-2">
          <img
            src="/apple-touch-icon.png?v=20261111-22"
            width={32}
            height={32}
            alt=""
            className="h-8 w-8 rounded-[7px]"
          />
          <span className="font-display text-lg tracking-wide text-cinema-text group-hover:text-cinema-accent">
            {en ? "Screen News" : "银幕新讯"}
          </span>
          <span className="hidden rounded-full border border-cinema-gold/30 bg-cinema-gold/10 px-2 py-0.5 text-[10px] font-medium text-cinema-gold sm:inline-block">
            {en ? "Release dates · new films" : "定档 · 发行动态"}
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href={comingSoonHref}
            className="text-xs tracking-wider text-cinema-muted hover:text-cinema-accent"
          >
            {en ? "Coming soon" : "即将上线"}
          </Link>
          <Link
            href={toggleHref}
            className="rounded-full border border-cinema-border/70 px-2 py-0.5 text-xs font-medium text-cinema-muted hover:border-cinema-accent/40 hover:text-cinema-accent"
            aria-label={en ? "切换到中文" : "Switch to English"}
          >
            {en ? "中文" : "EN"}
          </Link>
          <LoginButton en={en} />
          <a
            href="https://readcine.com"
            className="text-xs tracking-wider text-cinema-muted hover:text-cinema-accent"
          >
            readcine.
          </a>
        </nav>
      </div>
    </header>
  );
}
