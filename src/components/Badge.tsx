import type { TimelineEventType } from "@/types";
import type { Locale } from "@/lib/i18n";

const STYLES: Record<TimelineEventType, string> = {
  nomination: "bg-sky-500/20 text-sky-200",
  win: "bg-cinema-gold/25 text-cinema-gold-light",
  streaming: "bg-emerald-500/20 text-emerald-200",
  auteur: "bg-violet-500/20 text-violet-200",
};

const LABELS: Record<TimelineEventType, string> = {
  nomination: "入围",
  win: "获奖",
  streaming: "流媒体",
  auteur: "新片",
};

const LABELS_EN: Record<TimelineEventType, string> = {
  nomination: "Nominee",
  win: "Winner",
  streaming: "Streaming",
  auteur: "New film",
};

export function TypeBadge({
  type,
  label,
  headline,
  locale = "zh",
}: {
  type: TimelineEventType;
  label?: string;
  headline?: string;
  locale?: Locale;
}) {
  const fallback = locale === "en" ? LABELS_EN[type] : LABELS[type];
  const text = label === "新品" ? "新片" : label || fallback;
  if (type === "streaming" || (label && headline?.includes(label))) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[type]}`}
    >
      {text}
    </span>
  );
}
