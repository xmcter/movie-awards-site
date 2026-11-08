/** Stable first-publication time, never a streaming launch date. */
export function publicationTime(item: { publishedAt?: string; date?: string }): string {
  return item.publishedAt || item.date || "";
}

export function comparePublicationTime(
  a: { publishedAt?: string; date?: string; id?: string },
  b: { publishedAt?: string; date?: string; id?: string },
): number {
  const t = (Date.parse(publicationTime(b)) || 0) - (Date.parse(publicationTime(a)) || 0);
  if (t !== 0) return t;
  // Stable tiebreak: same-day hand-written items share a date-only fallback.
  return (a.id ?? "").localeCompare(b.id ?? "");
}
