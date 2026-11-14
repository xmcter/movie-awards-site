"use client";

import { useEffect } from "react";

/**
 * 主题始终跟随系统（prefers-color-scheme），不记住任何手动选择。
 * CSS 已用 @media 先行生效（无闪烁）；这里同步 html 类名并实时监听系统切换，
 * 同时清掉旧版 ReadCine 共享主题留下的 rc-theme cookie / localStorage。
 */
export default function ThemeInit() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const day = !mq.matches;
      const root = document.documentElement;
      root.classList.toggle("theme-day", day);
      root.classList.toggle("theme-night", !day);
      root.style.colorScheme = day ? "light" : "dark";
    };
    try {
      localStorage.removeItem("rc-theme");
      localStorage.removeItem("forcine-theme");
      if (/(?:^|;\s*)rc-theme=/.test(document.cookie)) {
        const x = "rc-theme=; path=/; max-age=0; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
        document.cookie = x;
        document.cookie = x + "; domain=.readcine.com";
      }
    } catch {}
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return null;
}
