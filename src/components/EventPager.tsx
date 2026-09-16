"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isClicked, markClicked } from "@/lib/readProgress";

export type PagerItem = {
  id: string;
  title: string;
};

export default function EventPager({
  currentId,
  items,
}: {
  currentId: string;
  items: PagerItem[];
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    markClicked(currentId);
    setTick((n) => n + 1);
  }, [currentId]);

  const { prev, next } = useMemo(() => {
    const i = items.findIndex((x) => x.id === currentId);
    return {
      prev: i > 0 ? items[i - 1] : null,
      next: i >= 0 ? items[i + 1] || null : null,
    };
  }, [items, currentId]);

  void tick;

  function card(item: PagerItem | null, label: string) {
    if (!item) {
      return (
        <div className="flex-1 rounded-xl border border-cinema-border px-3 py-3 text-xs text-cinema-muted/50">
          {label}
          <div className="mt-1">没有了</div>
        </div>
      );
    }
    const read = isClicked(item.id);
    return (
      <Link
        href={`/event/${encodeURIComponent(item.id)}`}
        prefetch={false}
        className="flex-1 rounded-xl border border-cinema-border bg-cinema-card px-3 py-3 transition hover:border-cinema-gold/40"
      >
        <div className="text-xs text-cinema-muted">{label}</div>
        <div className={`mt-1 line-clamp-2 text-sm ${read ? "text-cinema-muted" : "text-cinema-text"}`}>
          {read ? "已读 · " : "未读 · "}
          {item.title}
        </div>
      </Link>
    );
  }

  return (
    <div className="flex gap-3">
      {card(prev, "上一篇")}
      {card(next, "下一篇")}
    </div>
  );
}
