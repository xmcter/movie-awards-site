"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isEnPath, toEnPath, toZhPath } from "@/lib/i18n";
import {
  ALLOWED_EMAIL,
  clearPrefsSession,
  googleSignIn,
  loadPrefsSession,
  PrefsError,
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
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    setSession(loadPrefsSession());
    const onChange = () => setSession(loadPrefsSession());
    window.addEventListener("prefs-session-changed", onChange);
    // 另一个标签页登录/退出时，顶栏也要跟着变。
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("prefs-session-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const signIn = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await googleSignIn();
      setSession(loadPrefsSession());
      window.dispatchEvent(new Event("prefs-session-changed"));
    } catch (err) {
      // 登录失败/取消/非允许账号：留一句可见提示，不要静默失败。
      if (err instanceof PrefsError) {
        if (err.code === "forbidden") {
          setNotice(en ? `Only ${ALLOWED_EMAIL} can sign in` : `仅限 ${ALLOWED_EMAIL} 账号使用`);
        } else if (err.code === "api-unavailable") {
          setNotice(en ? "Preferences service unavailable; try again later" : "偏好服务不可用，稍后再试");
        } else {
          setNotice(en ? "Google sign-in didn't complete" : "谷歌登录未完成");
        }
      } else {
        setNotice(en ? "Google sign-in didn't complete" : "谷歌登录未完成");
      }
    } finally {
      setBusy(false);
    }
  }, [busy, en]);
  const signOut = useCallback(() => {
    // clearPrefsSession 会派 prefs-session-changed，顶栏随之刷新。
    clearPrefsSession();
    setSession(null);
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
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="rounded-full border border-cinema-border/70 px-2 py-0.5 text-xs font-medium text-cinema-muted hover:border-cinema-accent/40 hover:text-cinema-accent disabled:opacity-50"
      >
        {en ? "Sign in" : "登录"}
      </button>
      {notice ? (
        <div
          role="status"
          className="fixed right-3 top-14 z-[90] flex max-w-xs items-center gap-2 rounded-xl border border-cinema-border bg-cinema-card px-3 py-2 text-xs text-cinema-text shadow-lg"
        >
          <span className="line-clamp-2">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={en ? "Dismiss" : "关闭"}
            className="shrink-0 text-cinema-muted hover:text-cinema-gold"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}

function LangLink({ href, en }: { href: string; en: boolean }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-cinema-border/70 px-2 py-0.5 text-xs font-medium text-cinema-muted hover:border-cinema-accent/40 hover:text-cinema-accent"
      aria-label={en ? "切换到中文" : "Switch to English"}
    >
      {en ? "中文" : "EN"}
    </Link>
  );
}

const navLinkClass = "text-xs tracking-wider text-cinema-muted hover:text-cinema-accent";

export default function Header() {
  const pathname = usePathname();
  const en = isEnPath(pathname);
  const toggleHref = en ? toZhPath(pathname || "/en") : toEnPath(pathname || "/");
  const homeHref = en ? "/en" : "/";
  const comingSoonHref = en ? "/en/coming-soon" : "/coming-soon";
  const tagline = en ? "Release dates · new films" : "定档 · 发行动态";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 min-w-0 border-b border-cinema-border/80 bg-cinema-bg/90 backdrop-blur-md">
      <div className="mx-auto min-w-0 max-w-3xl px-4 sm:px-6">
        <div className="flex min-w-0 items-center justify-between gap-2 py-3">
          <Link href={homeHref} className="group flex min-w-0 items-center gap-2">
            <img
              src="/apple-touch-icon.png?v=20261111-22"
              width={32}
              height={32}
              alt=""
              className="h-8 w-8 shrink-0 rounded-[7px]"
            />
            <span className="min-w-0 truncate font-display text-lg tracking-wide text-cinema-text group-hover:text-cinema-accent">
              {en ? "Screen News" : "银幕新讯"}
            </span>
            <span className="hidden shrink-0 rounded-full border border-cinema-gold/30 bg-cinema-gold/10 px-2 py-0.5 text-[10px] font-medium text-cinema-gold sm:inline-block">
              {tagline}
            </span>
          </Link>
          <nav className="hidden shrink-0 items-center gap-4 sm:flex">
            <Link href={comingSoonHref} className={navLinkClass}>
              {en ? "Coming soon" : "即将上线"}
            </Link>
            <LangLink href={toggleHref} en={en} />
            <LoginButton en={en} />
            <a href="https://readcine.com" className={navLinkClass}>
              readcine.
            </a>
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <LangLink href={toggleHref} en={en} />
            <button
              ref={buttonRef}
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cinema-border/70 text-sm text-cinema-muted hover:border-cinema-accent/40 hover:text-cinema-accent"
              aria-expanded={open}
              aria-controls="site-header-menu"
              aria-label={open ? (en ? "Close menu" : "关闭菜单") : (en ? "Open menu" : "打开菜单")}
              onClick={() => setOpen((value) => !value)}
            >
              <span aria-hidden="true">{open ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>
        <div
          id="site-header-menu"
          ref={panelRef}
          className={`${open ? "flex" : "hidden"} flex-col items-start gap-3 border-t border-cinema-border/80 py-3 sm:hidden`}
        >
          {open ? (
            <>
              <span className="rounded-full border border-cinema-gold/30 bg-cinema-gold/10 px-2 py-0.5 text-[10px] font-medium text-cinema-gold">
                {tagline}
              </span>
              <Link href={comingSoonHref} className={navLinkClass} onClick={() => setOpen(false)}>
                {en ? "Coming soon" : "即将上线"}
              </Link>
              <LoginButton en={en} />
              <a href="https://readcine.com" className={navLinkClass}>
                readcine.
              </a>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
