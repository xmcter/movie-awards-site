"use client";

import { useEffect, useState } from "react";
import { formatReleaseWeek } from "@/lib/labels";
import { formatReleaseWeekEn, type Locale } from "@/lib/i18n";

/** 静态导出初始显示绝对日期；hydrate后按上海当天重算，跨日/重新打开标签页也刷新。 */
export default function ReleaseLabel({ date, title, fallback, locale = "zh" }: { date: string; title?: string; fallback: string; locale?: Locale }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setLabel(locale === "en" ? formatReleaseWeekEn(date) : formatReleaseWeek(date));
    update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [date, locale]);
  if (locale === "en") {
    return <>{label ? (title ? `${title} · ${label}` : label) : fallback}</>;
  }
  return <>{label ? (title ? `《${title}》 · ${label}` : label) : fallback}</>;
}
