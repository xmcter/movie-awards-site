/** Stable first-publication time, never a streaming launch date. */
export function publicationTime(item: { publishedAt?: string; date?: string }): string {
  return item.publishedAt || item.date || "";
}

export function comparePublicationTime(
  a: { publishedAt?: string },
  b: { publishedAt?: string },
): number {
  return (Date.parse(publicationTime(b)) || 0) - (Date.parse(publicationTime(a)) || 0);
}
