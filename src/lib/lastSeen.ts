/**
 * 「上次看到这里」marker. Pure helpers (no React) so they can be unit-tested.
 *
 * Stored in localStorage under LAST_SEEN_KEY as
 *   { date: newest visible card date, id: newest card id, ids: ids of the
 *     newest cards on that visit, ts: epoch ms }
 * A card counts as "new" when its date is later than the marker date, or it
 * shares the marker date but was not among the cards visible last time.
 */

export const LAST_SEEN_KEY = "news_last_seen_v1";
const MAX_IDS = 60;

export interface LastSeenMarker {
  date: string;
  id: string;
  ids: string[];
  ts: number;
}

export interface MarkerSource {
  id: string;
  date: string;
}

export function readLastSeen(): LastSeenMarker | null {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.date !== "string" || !v.date) return null;
    return {
      date: v.date,
      id: typeof v.id === "string" ? v.id : "",
      ids: Array.isArray(v.ids) ? v.ids.filter((x: unknown) => typeof x === "string") : [],
      ts: typeof v.ts === "number" ? v.ts : 0,
    };
  } catch {
    return null;
  }
}

/** Build a marker from the cards currently visible (newest first, dismissed excluded). */
export function buildMarker(visible: MarkerSource[], now = Date.now()): LastSeenMarker | null {
  const dated = visible.filter((e) => e.date);
  if (dated.length === 0) return null;
  let newest = dated[0]!;
  for (const e of dated) if (e.date > newest.date) newest = e;
  const ids = dated
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_IDS)
    .map((e) => e.id);
  return { date: newest.date, id: newest.id, ids, ts: now };
}

/**
 * Merge so the marker never moves backwards (e.g. a later visit where the
 * newest card was dismissed, or a stale cached page).
 */
export function mergeMarker(prev: LastSeenMarker | null, next: LastSeenMarker): LastSeenMarker {
  if (!prev) return next;
  if (prev.date > next.date) {
    return { ...prev, ts: next.ts };
  }
  const ids = Array.from(new Set([...next.ids, ...(prev.date === next.date ? prev.ids : [])])).slice(
    0,
    MAX_IDS * 2,
  );
  return { ...next, ids };
}

export function writeLastSeen(visible: MarkerSource[]): void {
  const next = buildMarker(visible);
  if (!next) return;
  try {
    const merged = mergeMarker(readLastSeen(), next);
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota / private mode */
  }
}

export function isNewSince(e: MarkerSource, marker: LastSeenMarker | null): boolean {
  if (!marker || !e.date) return false;
  if (e.date > marker.date) return true;
  if (e.date === marker.date) return !marker.ids.includes(e.id);
  return false;
}

/**
 * The baseline used for this visit. Read once from localStorage at the start
 * of a visit and pinned in sessionStorage for VISIT_WINDOW_MS, so clicking
 * into a film page and coming back keeps the 「新」 badges instead of
 * clearing them mid-visit. A stale session copy (tab left open for hours)
 * falls back to the persisted marker.
 */
const SESSION_KEY = "news_last_seen_visit_v1";
const VISIT_WINDOW_MS = 30 * 60 * 1000;

export function getVisitBaseline(now = Date.now()): LastSeenMarker | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && typeof v.at === "number" && now - v.at < VISIT_WINDOW_MS) {
        return v.marker ?? null;
      }
    }
  } catch {
    /* ignore */
  }
  const marker = readLastSeen();
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: now, marker }));
  } catch {
    /* ignore */
  }
  return marker;
}
