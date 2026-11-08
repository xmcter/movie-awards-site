"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isEnPath } from "@/lib/i18n";

/** The root layout can only render one <html lang>. Sync it to the route so
 *  /en/ pages report lang="en" (and Chinese pages keep lang="zh-CN"). */
export default function LangSync() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = isEnPath(pathname) ? "en" : "zh-CN";
  }, [pathname]);
  return null;
}
