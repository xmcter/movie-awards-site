import type { TimelineEventType } from "@/types";

const STYLES: Record<TimelineEventType, string> = {
  nomination: "bg-sky-500/15 text-sky-300",
  win: "bg-cinema-gold/20 text-cinema-gold-light",
  streaming: "bg-emerald-500/15 text-emerald-300",
  auteur: "bg-violet-500/15 text-violet-300",
};

const LABELS: Record<TimelineEventType, string> = {
  nomination: "入围",
  win: "获奖",
  streaming: "流媒体",
  auteur: "作者",
};

export function TypeBadge({ type }: { type: TimelineEventType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[type]}`}
    >
      {LABELS[type]}
    </span>
  );
}
