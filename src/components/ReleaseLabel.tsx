"use client";

import { useEffect, useState } from "react";
import { formatReleaseWeek } from "@/lib/labels";

/** 静态导出初始显示绝对日期；hydrate后按上海当天重算，跨日/重新打开标签页也刷新。 */
export default function ReleaseLabel({ date, title, fallback }: { date: string; title?: string; fallback: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setLabel(formatReleaseWeek(date));
    update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [date]);
  return <>{label ? (title ? `《${title}》 · ${label}` : label) : fallback}</>;
}
