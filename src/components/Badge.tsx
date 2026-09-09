import type { AwardResult, ReleaseStatus } from "@/types";
import { AWARD_RESULT_LABELS, RELEASE_STATUS_LABELS } from "@/lib/labels";

export function AwardBadge({ result }: { result: AwardResult }) {
  const won = result === "won";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        won
          ? "bg-cinema-gold/20 text-cinema-gold-light"
          : "bg-cinema-elevated text-cinema-muted"
      }`}
    >
      {AWARD_RESULT_LABELS[result]}
    </span>
  );
}

export function StatusBadge({ status }: { status: ReleaseStatus }) {
  const styles: Record<ReleaseStatus, string> = {
    announced: "bg-emerald-500/15 text-emerald-300",
    estimated: "bg-amber-500/15 text-amber-200",
    tba: "bg-cinema-elevated text-cinema-muted",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {RELEASE_STATUS_LABELS[status]}
    </span>
  );
}
