/** English headline/body builders for /en/ timeline events.
 * Mirrors src/lib/headlines.ts structurally, but produces English copy.
 * Streaming notes are Chinese marketing boilerplate and are not translated,
 * so the English streaming body is intentionally empty — the card shows the
 * headline plus the English plot, same as the Chinese card does when the
 * note carries no incremental facts.
 */
import type { Film } from "@/types";
import { filmTitleEn } from "@/lib/i18n";
import { isPastReleaseDate } from "@/lib/labels";

/** Streaming headline: "The Odyssey · Streaming Nov 21" (announced),
 *  "Title · Expected Nov 21" (estimated), "Title · TBA" (tba). */
export function buildStreamingHeadlineEn(opts: {
  film: Film;
  statusLabel: string;
  datePart: string;
  date?: string;
}): string {
  const { film, statusLabel, datePart } = opts;
  const title = filmTitleEn(film);
  if (statusLabel === "TBA") return `${title} · TBA`;
  if (statusLabel === "Expected") {
    return datePart ? `${title} · Expected ${datePart}` : `${title} · Expected`;
  }
  if (datePart) {
    return opts.date && isPastReleaseDate(opts.date)
      ? `${title} · Streaming since ${datePart}`
      : `${title} · Streaming ${datePart}`;
  }
  return title;
}

/** English streaming body: notes are untranslated Chinese boilerplate. */
export function buildStreamingBodyEn(): string {
  return "";
}

/** Auteur headline from the translated summary; already newsy enough as-is. */
export function polishAuteurHeadlineEn(summaryEn: string, film: Film): string {
  const s = (summaryEn || "").trim();
  if (!s) return filmTitleEn(film);
  return s.length > 90 ? `${s.slice(0, 88)}…` : s;
}

/** English equivalent of dedupeSubtitleAgainstTitle: drop a subtitle that
 *  merely repeats the title, or strip list items already in the title. */
export function dedupeSubtitleAgainstTitleEn(title: string, subtitle: string): string {
  const t = (title || "").trim();
  const s = (subtitle || "").trim();
  if (!s) return "";
  if (!t) return s;

  const norm = (v: string) =>
    v
      .toLowerCase()
      .replace(/[\s·•|/,_.;:!?\-—_()\[\]"'“”‘’«»]/g, "");

  const nt = norm(t);
  const ns = norm(s);
  if (!ns) return "";
  if (nt === ns) return "";
  if (ns.length <= nt.length + 4 && nt.includes(ns)) return "";
  if (nt.length >= 8 && ns.startsWith(nt) && ns.length - nt.length <= 6) return "";
  if (ns.length <= 80 && nt.length >= 6) {
    const shorter = ns.length <= nt.length ? ns : nt;
    const longer = ns.length <= nt.length ? nt : ns;
    if (longer.includes(shorter) && shorter.length / longer.length >= 0.85) return "";
  }

  // "A · B · C" style short lists: drop items already in the title.
  const looksLikeList =
    (s.includes("·") || s.includes("|")) && s.length <= 160 && (s.match(/[·|]/g) || []).length >= 1;
  if (looksLikeList) {
    const parts = s
      .split(/\s*[·|]\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    const kept = parts.filter((p) => {
      const np = norm(p);
      if (!np) return false;
      return !nt.includes(np);
    });
    if (kept.length === 0) return "";
    if (kept.length === parts.length) return s;
    return kept.join(" · ");
  }

  // Prose subtitle: strip title tokens, then drop if almost nothing is left.
  const titleTokens = t
    .split(/\s*[·|/,.;:!?]\s*/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
  let prose = s;
  for (const tok of titleTokens) {
    const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    prose = prose.replace(new RegExp(esc, "gi"), " ");
  }
  prose = prose
    .replace(/\b(streaming|premiere|release|debut|dated|now streaming|coming soon)\b/gi, " ")
    .replace(/[·|/,_.;:!?\-—_()\[\]]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!prose || prose.length <= 2) return "";
  if (s.length <= 72 && prose.length / s.length < 0.35) return "";

  return s;
}
