"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isEnPath } from "@/lib/i18n";

import { SHOW_SOURCES_KEY } from "@/components/ShowSources";

/** The root layout can only render one <html lang>. Sync it to the route so
 *  /en/ pages report lang="en" (and Chinese pages keep lang="zh-CN"). */
export default function LangSync() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = isEnPath(pathname) ? "en" : "zh-CN";
    // Private sources switch: ?show-sources=1 turns it on for this device,
    // ?show-sources=0 turns it off. The flag persists in localStorage.
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("show-sources");
      if (v === "1" || v === "0") {
        if (v === "1") localStorage.setItem(SHOW_SOURCES_KEY, "1");
        else localStorage.removeItem(SHOW_SOURCES_KEY);
        params.delete("show-sources");
        const qs = params.toString();
        const url =
          window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
        window.history.replaceState(null, "", url);
        window.dispatchEvent(new Event("news-show-sources-changed"));
        window.location.reload();
      }
    } catch {
      /* storage unavailable: leave the switch off */
    }
  }, [pathname]);
  return null;
}
