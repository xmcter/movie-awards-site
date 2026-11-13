import type { Metadata } from "next";
import Link from "next/link";
import { getComingSoonReleases, todayISO, type ComingSoonRelease } from "@/lib/data";
import { formatDateEn, bilingualAlternatesEn } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Coming soon",
  description: "New films hitting streaming this week, next week, this month and this year.",
  alternates: bilingualAlternatesEn("/en/coming-soon"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://news.readcine.com/en/coming-soon",
    siteName: "Screen News",
    title: "Coming soon",
    description: "New films hitting streaming this week, next week, this month and this year.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
  },
};

export const dynamic = "force-static";

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00+08:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Next-week section: show “Next Tue” instead of the date. */
function nextWeekdayLabelEn(iso: string): string {
  const d = new Date(`${iso}T12:00:00+08:00`);
  return `Next ${WEEKDAY_EN[d.getDay()]}`;
}

function initials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const latin = trimmed.match(/[A-Za-z]+/g);
  if (latin && latin.length > 0) {
    return latin.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  }
  return trimmed.slice(0, 2);
}

function thumbSrc(poster?: string): string | undefined {
  if (!poster) return undefined;
  if (poster.startsWith("/posters/")) {
    return `/thumbs/${poster.split("/").pop()!.replace(/\.[^.]+$/, "")}.webp`;
  }
  return poster;
}

function ReleaseRow({ release, dateText }: { release: ComingSoonRelease; dateText?: string }) {
  const colors = release.posterColors || ["#1a1a2e", "#334155"];
  const src = thumbSrc(release.poster);
  return (
    <li className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3">
      <Link
        href={`/en/film/${encodeURIComponent(release.filmId)}`}
        className="flex items-start gap-3"
      >
        <span
          className="h-[90px] w-[60px] shrink-0 overflow-hidden rounded-md"
          style={{
            background: colors[0],
            aspectRatio: "2 / 3",
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={release.filmTitle}
              loading="lazy"
              decoding="async"
              width={120}
              height={180}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-1 text-center font-display text-lg tracking-wide text-white/80">
              {initials(release.filmTitleEn || release.filmTitle)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-cinema-text hover:text-cinema-gold">
            {release.filmTitle}
          </span>
          <span className="mt-1 block text-xs text-cinema-muted">
            {dateText ?? formatDateEn(release.date)}
            {release.directors?.[0] ? ` · ${release.directors[0]}` : ""}
            {release.filmYear ? ` · ${release.filmYear}` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function ComingSoonPageEn() {
  const today = todayISO();
  const releases = getComingSoonReleases(new Date(), "en");
  const dow = new Date(`${today}T12:00:00+08:00`).getDay(); // 0=Sunday
  const thisWeekEnd = addDays(today, (7 - dow) % 7);
  const nextWeekStart = addDays(thisWeekEnd, 1);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  const monthEndDate = (() => {
    const d = new Date(`${today.slice(0, 8)}01T12:00:00+08:00`);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();
  const yearEnd = `${today.slice(0, 4)}-12-31`;
  // When next week crosses into the next month, "Rest of the month" has no
  // days left (its range would read backwards); same for "Rest of the year"
  // in December. Hide the empty segment instead of showing an inverted range.
  const restMonthStart = addDays(nextWeekEnd, 1);
  const restYearStart = addDays(monthEndDate, 1);

  const buckets: { name: string; range: string; weekday: boolean; items: ComingSoonRelease[] }[] = [
    {
      name: "This week",
      range: formatDateEn(today) + (thisWeekEnd === today ? "" : `–${formatDateEn(thisWeekEnd)}`),
      weekday: false,
      items: releases.filter((r) => r.date >= today && r.date <= thisWeekEnd),
    },
    {
      name: "Next week",
      range: `${formatDateEn(nextWeekStart)}–${formatDateEn(nextWeekEnd)}`,
      weekday: true,
      items: releases.filter((r) => r.date >= nextWeekStart && r.date <= nextWeekEnd),
    },
    ...(restMonthStart <= monthEndDate
      ? [
          {
            name: "Rest of the month",
            range: `${formatDateEn(restMonthStart)}–${formatDateEn(monthEndDate)}`,
            weekday: false,
            items: releases.filter((r) => r.date > nextWeekEnd && r.date <= monthEndDate),
          },
        ]
      : []),
    ...(restYearStart <= yearEnd
      ? [
          {
            name: "Rest of the year",
            range: `${formatDateEn(restYearStart)}–${formatDateEn(yearEnd)}`,
            weekday: false,
            items: releases.filter((r) => r.date > monthEndDate && r.date <= yearEnd),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl text-cinema-text">Coming soon</h1>
        <p className="mt-2 text-sm text-cinema-muted">
          {releases.length} new film{releases.length === 1 ? "" : "s"} dated · grouped by release window
        </p>
      </header>
      {buckets.map((bucket) => (
        <section key={bucket.name}>
          <h2 className="font-display text-lg text-cinema-text">
            {bucket.name}
            <span className="ml-2 text-sm font-normal text-cinema-muted">
              {bucket.range} · {bucket.items.length} film{bucket.items.length === 1 ? "" : "s"}
            </span>
          </h2>
          {bucket.items.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-cinema-border px-4 py-6 text-center text-sm text-cinema-muted">
              No new films in this window
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {bucket.items.map((release) => (
                <ReleaseRow
                  key={`${release.filmId}-${release.platform}-${release.date}`}
                  release={release}
                  dateText={bucket.weekday ? nextWeekdayLabelEn(release.date) : undefined}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
