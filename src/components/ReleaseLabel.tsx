"use client";

import { useEffect, useState } from "react";
import { formatReleaseWeek } from "@/lib/labels";
import { type Locale } from "@/lib/i18n";

/** 静态导出初始显示绝对日期；hydrate后按上海当天重算，跨日/重新打开标签页也刷新。
 * 英文标题在服务端已经写好平台和完整日期，hydrate 后不再换成相对周标签。 */
export default function ReleaseLabel({ date, title, fallback, locale = "zh" }: { date: string; title?: string; fallback: string; locale?: Locale }) {
  if (locale === "en") return <>{fallback}</>;
  return <ReleaseLabelZh date={date} title={title} fallback={fallback} />;
}

function ReleaseLabelZh({ date, title, fallback }: { date: string; title?: string; fallback: string }) {
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
