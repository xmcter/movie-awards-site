import type { TimelineEventType } from "@/types";

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

export function TypeBadge({
  type,
  label,
}: {
  type: TimelineEventType;
  label?: string;
}) {
  const text = label === "新品" ? "新片" : label || LABELS[type];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[type]}`}
    >
      {text}
    </span>
  );
}
