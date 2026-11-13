"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isClicked, markClicked } from "@/lib/readProgress";
import type { Locale } from "@/lib/i18n";
import type { TimelineEvent, TimelineEventType } from "@/types";
import {
  DISMISS_EVENT_NAME,
  isBlockedOrSimilar,
  loadDismissMarks,
  type DismissStore,
} from "@/lib/dismiss";

export type PagerItem = {
  id: string;
  title: string;
  filmId?: string;
  type: TimelineEventType;
  headline?: string;
  summary?: string;
};

function asTimelineEvent(item: PagerItem): TimelineEvent {
  return {
    id: item.id,
    type: item.type,
    date: "",
    dateLabel: "",
    filmId: item.filmId,
    filmTitle: item.title,
    headline: item.headline,
    summary: item.summary || "",
    badge: "",
  };
}

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
  const [store, setStore] = useState<DismissStore>({ blocked: {} });

  useEffect(() => {
    markClicked(currentId);
    setStore(loadDismissMarks());
    setTick((n) => n + 1);
    const refresh = () => setStore(loadDismissMarks());
    window.addEventListener(DISMISS_EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DISMISS_EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [currentId]);

  const { prev, next } = useMemo(() => {
    const i = items.findIndex((x) => x.id === currentId);
    if (i < 0) return { prev: null, next: null };
    const open = (item: PagerItem) => !isBlockedOrSimilar(asTimelineEvent(item), store);
    let prevItem: PagerItem | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (open(items[j]!)) {
        prevItem = items[j]!;
        break;
      }
    }
    let nextItem: PagerItem | null = null;
    for (let j = i + 1; j < items.length; j++) {
      if (open(items[j]!)) {
        nextItem = items[j]!;
        break;
      }
    }
    return { prev: prevItem, next: nextItem };
  }, [items, currentId, store]);

  void tick;

  if (!prev && !next) return null;
  const en = locale === "en";
  return (
    <div className={`mt-10 grid gap-3 ${prev && next ? "sm:grid-cols-2" : ""}`}>
      {prev ? (
        <PagerLink item={prev} locale={locale} label={en ? "Previous" : "上一篇"} read={isClicked(prev.id)} />
      ) : null}
      {next ? (
        <PagerLink item={next} locale={locale} label={en ? "Next" : "下一篇"} read={isClicked(next.id)} />
      ) : null}
    </div>
  );
}

function PagerLink({
  item,
  locale,
  label,
  read,
}: {
  item: PagerItem;
  locale: Locale;
  label: string;
  read: boolean;
}) {
  const en = locale === "en";
  return (
    <Link
      href={`${en ? "/en" : ""}/event/${encodeURIComponent(item.id)}`}
      prefetch={false}
      className="block rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 transition hover:border-cinema-gold/40"
    >
      <div className="text-xs text-cinema-muted">{label}</div>
      <div className={`mt-1 text-sm ${read ? "text-cinema-muted" : "text-cinema-text"}`}>
        {read ? (en ? "Read · " : "已读 · ") : (en ? "Unread · " : "未读 · ")}
        {item.title}
      </div>
    </Link>
  );
}
