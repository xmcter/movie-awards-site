import type { Metadata } from "next";
import Link from "next/link";
import { getComingSoonReleases, todayISO, type ComingSoonRelease } from "@/lib/data";
import { formatDate, PLATFORM_LABELS } from "@/lib/labels";

export const metadata: Metadata = {
  title: "即将上线",
  description: "本周、下周、本月内及今年内即将上线流媒体的新片定档。",
  alternates: {
    canonical: "/coming-soon",
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

function ReleaseRow({ release }: { release: ComingSoonRelease }) {
  const colors = release.posterColors || ["#1a1a2e", "#334155"];
  const src = thumbSrc(release.poster);
  return (
    <li className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3">
      <Link
        href={`/film/${encodeURIComponent(release.filmId)}`}
        className="flex items-start gap-3"
      >
        <span
          className="h-[90px] w-[60px] shrink-0 overflow-hidden rounded-md"
          style={{
            background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
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
            {release.filmTitleEn ? (
              <span className="text-cinema-muted"> / {release.filmTitleEn}</span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs text-cinema-muted">
            {formatDate(release.date)}
            {" · "}
            {PLATFORM_LABELS[release.platform as keyof typeof PLATFORM_LABELS] || release.platform}
            {release.directors?.[0] ? ` · ${release.directors[0]}` : ""}
            {release.filmYear ? ` · ${release.filmYear}年` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function ComingSoonPage() {
  const today = todayISO();
  const releases = getComingSoonReleases();
  const dow = new Date(`${today}T12:00:00+08:00`).getDay(); // 0=周日
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

  const buckets: { name: string; range: string; items: ComingSoonRelease[] }[] = [
    {
      name: "本周",
      range: formatDate(today) + (thisWeekEnd === today ? "" : `–${formatDate(thisWeekEnd)}`),
      items: releases.filter((r) => r.date >= today && r.date <= thisWeekEnd),
    },
    {
      name: "下一周",
      range: `${formatDate(nextWeekStart)}–${formatDate(nextWeekEnd)}`,
      items: releases.filter((r) => r.date >= nextWeekStart && r.date <= nextWeekEnd),
    },
    {
      name: "本月剩余",
      range: `${formatDate(addDays(nextWeekEnd, 1))}–${formatDate(monthEndDate)}`,
      items: releases.filter((r) => r.date > nextWeekEnd && r.date <= monthEndDate),
    },
    {
      name: "今年剩余",
      range: `${formatDate(addDays(monthEndDate, 1))}–${formatDate(yearEnd)}`,
      items: releases.filter((r) => r.date > monthEndDate && r.date <= yearEnd),
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl text-cinema-text">即将上线</h1>
        <p className="mt-2 text-sm text-cinema-muted">
          共 {releases.length} 部新片定档 · 按上线日期分段
        </p>
      </header>
      {buckets.map((bucket) => (
        <section key={bucket.name}>
          <h2 className="font-display text-lg text-cinema-text">
            {bucket.name}
            <span className="ml-2 text-sm font-normal text-cinema-muted">
              {bucket.range} · {bucket.items.length} 部
            </span>
          </h2>
          {bucket.items.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-cinema-border px-4 py-6 text-center text-sm text-cinema-muted">
              暂无新片上线
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {bucket.items.map((release) => (
                <ReleaseRow
                  key={`${release.filmId}-${release.platform}-${release.date}`}
                  release={release}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
