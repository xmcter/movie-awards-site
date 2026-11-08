"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Private sources switch.
 *
 * Source attributions (the "来源·XXX" tags on the timeline and event pages,
 * and the reference-sources list on About) are hidden from the public site
 * by default and only render on devices where this switch is on.
 *
 * Turn it on by visiting any page with ?show-sources=1 (LangSync stores it
 * in localStorage and reloads); turn it off with ?show-sources=0. The flag
 * persists per device/browser.
 *
 * Note: this gates display only. The site is a static export, so the source
 * label/URL are still present in the page's static HTML source (view-source
 * can reveal them). Truly removing them from the public HTML would need a
 * server-side gate, which a static site does not have.
 */
export const SHOW_SOURCES_KEY = "news_show_sources";

export function readShowSources(): boolean {
  try {
    return localStorage.getItem(SHOW_SOURCES_KEY) === "1";
  } catch {
    return false;
  }
}

export function useShowSources(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(readShowSources());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SHOW_SOURCES_KEY) setShow(readShowSources());
    };
    const onCustom = () => setShow(readShowSources());
    window.addEventListener("storage", onStorage);
    window.addEventListener("news-show-sources-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("news-show-sources-changed", onCustom);
    };
  }, []);
  return show;
}

/** Renders children only on devices where the private sources switch is on. */
export default function ShowSources({ children }: { children: ReactNode }) {
  const show = useShowSources();
  if (!show) return null;
  return <>{children}</>;
}
