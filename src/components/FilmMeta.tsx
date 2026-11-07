"use client";

import { useEffect, useState } from "react";
import { shanghaiYear } from "@/lib/labels";

/** 制作年元信息：当年省略，跨年保留；客户端使用上海年并在跨年/恢复页面时重算。 */
export default function FilmMeta({ year, parts = [] }: { year?: number; parts?: string[] }) {
  // 初始不输出年份，保证静态HTML/hydration一致；加载后显示需要保留的历史年份。
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setCurrentYear(shanghaiYear());
    update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const visibleYear = currentYear !== null && year && year !== currentYear ? String(year) : "";
  return <span data-film-meta>{[visibleYear, ...parts].filter(Boolean).join(" · ")}</span>;
}
