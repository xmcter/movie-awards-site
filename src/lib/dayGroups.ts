/** Day grouping + labels for the timeline. Labels use Asia/Shanghai. */

const TZ = "Asia/Shanghai";
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function shanghaiToday(now = new Date()): string {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  const t = new Date(Date.UTC(y!, (m || 1) - 1, d || 1) + delta * 86400000);
  return t.toISOString().slice(0, 10);
}

/** Absolute label, e.g. 「10月20日 周二」; prefixes year when not in currentYear. */
export function absoluteDayLabel(iso: string, currentYear?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "日期待定";
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  const wd = WEEKDAYS[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()];
  const yearPart = currentYear && String(y) !== currentYear ? `${y}年` : "";
  return `${yearPart}${m}月${d}日 ${wd}`;
}

/** Relative prefix 「今天」/「昨天」 or "" — only call on the client. */
export function relativeDayPrefix(iso: string, today: string): string {
  if (iso === today) return "今天";
  if (iso === addDays(today, -1)) return "昨天";
  return "";
}

export interface DayGroup<T> {
  day: string;
  items: T[];
}

/** Stable group by day; days ordered newest first, item order inside a day preserved. */
export function groupByDay<T>(items: T[], dayOf: (t: T) => string): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = dayOf(it) || "tba";
    const arr = map.get(k);
    if (arr) arr.push(it);
    else map.set(k, [it]);
  }
  return Array.from(map.entries())
    .sort((a, b) => {
      // undated ("tba") groups go last
      if (a[0] === "tba") return b[0] === "tba" ? 0 : 1;
      if (b[0] === "tba") return -1;
      return b[0].localeCompare(a[0]);
    })
    .map(([day, items]) => ({ day, items }));
}
