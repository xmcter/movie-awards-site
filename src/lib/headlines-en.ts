/** English headline/body builders for /en/ timeline events.
 * Mirrors src/lib/headlines.ts structurally, but produces English copy.
 * Streaming notes are Chinese marketing boilerplate and are not translated,
 * so the English streaming body is intentionally empty — the card shows the
 * headline plus the English plot, same as the Chinese card does when the
 * note carries no incremental facts.
 */
import type { Film } from "@/types";
import { filmTitleEn, formatDateEnLong, PLATFORM_LABELS_EN } from "@/lib/i18n";
import { isPastReleaseDate } from "@/lib/labels";

const HAN_CHAR = /[\u4e00-\u9fff]/;

/** Named services that arrive with platform code "other" and a note prefix. */
const NAMED_FROM_NOTE: Array<[RegExp, string]> = [
  [/^AMC\+$/i, "AMC+"],
  [/^Peacock$/i, "Peacock"],
  [/^Paramount\+$/i, "Paramount+"],
  [/^HBO Max\b/i, "Max"],
  [/^Max\b/i, "Max"],
  [/^Prime Video\b/i, "Prime Video"],
  [/^Apple TV\+/i, "Apple TV+"],
  [/^Disney\+$/i, "Disney+"],
  [/^Hulu$/i, "Hulu"],
  [/^Netflix$/i, "Netflix"],
  [/^MUBI\b/i, "MUBI"],
  [/^iTunes$/i, "Apple TV+"],
];

/** "Netflix", "AMC+", or "digitally" when the release is not one named service. */
export function streamingServiceEn(platform?: string, note?: string): string {
  const code = (platform || "").trim();
  if (code && code !== "other") return PLATFORM_LABELS_EN[code] || code;
  const head = (note || "").split("·")[0].replace(/\s+/g, " ").trim();
  if (!head || HAN_CHAR.test(head)) return "digitally";
  if (/^PVOD(?:\/VOD)?$/i.test(head) || /^VOD$/i.test(head)) return "digitally";
  for (const [re, name] of NAMED_FROM_NOTE) {
    if (re.test(head)) return name;
  }
  return "digitally";
}

/** Clause after the title: "streams on Netflix on November 30, 2026". */
function streamingClause(opts: {
  date?: string;
  status?: string;
  platform?: string;
  note?: string;
}): string {
  const service = streamingServiceEn(opts.platform, opts.note);
  const named = service !== "digitally";
  const when = opts.date ? formatDateEnLong(opts.date) : "";
  if (opts.status === "tba" || !opts.date) {
    return named ? `on ${service}, date to be announced` : "streaming date to be announced";
  }
  if (opts.status === "estimated") {
    return named ? `is expected on ${service} on ${when}` : `is expected digitally on ${when}`;
  }
  if (isPastReleaseDate(opts.date)) {
    return named
      ? `has been streaming on ${service} since ${when}`
      : `has been streaming digitally since ${when}`;
  }
  return named ? `streams on ${service} on ${when}` : `streams digitally on ${when}`;
}

/** "Avengers: Endgame streams on Disney+ on November 13, 2026". */
export function buildStreamingHeadlineEn(opts: {
  film: Film;
  date?: string;
  status?: string;
  platform?: string;
  note?: string;
}): string {
  const title = filmTitleEn(opts.film);
  const clause = streamingClause(opts);
  if (clause === "streaming date to be announced") return `${title}, ${clause}`;
  return `${title} ${clause}`;
}

/** Film-page line, same facts as the headline, without repeating the title. */
export function streamingWhenWhereEn(opts: {
  date?: string;
  status?: string;
  platform?: string;
  note?: string;
}): string {
  const clause = streamingClause(opts);
  return clause.charAt(0).toUpperCase() + clause.slice(1);
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
