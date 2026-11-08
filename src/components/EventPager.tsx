"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isClicked, markClicked } from "@/lib/readProgress";
import type { Locale } from "@/lib/i18n";

export type PagerItem = {
  id: string;
  title: string;
};

export default function EventPager({
  currentId,
  items,
  locale = "zh",
}: {
  currentId: string;
  items: PagerItem[];
  locale?: Locale;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    markClicked(currentId);
    setTick((n) => n + 1);
  }, [currentId]);

  const next = useMemo(() => {
    const i = items.findIndex((x) => x.id === currentId);
    return i >= 0 ? items[i + 1] || null : null;
  }, [items, currentId]);

  void tick;

  if (!next) return null;
  const read = isClicked(next.id);
  return (
    <div className="mt-10">
      <Link
        href={`${locale === "en" ? "/en" : ""}/event/${encodeURIComponent(next.id)}`}
        prefetch={false}
        className="block rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 transition hover:border-cinema-gold/40"
      >
        <div className="text-xs text-cinema-muted">{locale === "en" ? "Next" : "下一篇"}</div>
        <div className={`mt-1 text-sm ${read ? "text-cinema-muted" : "text-cinema-text"}`}>
          {read ? (locale === "en" ? "Read · " : "已读 · ") : (locale === "en" ? "Unread · " : "未读 · ")}
          {next.title}
        </div>
      </Link>
    </div>
  );
}
