import type { Metadata } from "next";
import FilmIndex, { type FilmIndexItem } from "@/components/FilmIndex";
import { seenTokens } from "@/lib/crossSeenKeys";
import { FILM_ALIASES, doubanRatingOf, films, doubanIdOf } from "@/lib/data";
import { bilingualAlternatesEn, filmTitleEn } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "All films",
  description: "Every film page on this site, sorted by title.",
  alternates: bilingualAlternatesEn("/en/films"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://news.readcine.com/en/films",
    siteName: "Screen News",
    title: "All films",
    description: "Every film page on this site, sorted by title.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "All films",
    description: "Every film page on this site, sorted by title.",
    images: ["/og.png"],
  },
};

export const dynamic = "force-static";

function initials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const latin = trimmed.match(/[A-Za-z]+/g);
  if (latin && latin.length > 0) {
    return latin.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("");
  }
  return trimmed.slice(0, 1);
}

function thumbFor(poster?: string): string | undefined {
  if (!poster || /^https?:\/\//i.test(poster)) return undefined;
  const file = poster.split("/").pop()?.split(/[?#]/)[0] ?? "";
  if (!file || file.includes("..")) return undefined;
  const stem = file.replace(/\.[^.]+$/, "");
  return stem ? `/thumbs/${stem}.webp` : undefined;
}

export default function FilmsPageEn() {
  const seen = new Set<string>();
  const list = films
    .filter((film) => !(film.id in FILM_ALIASES))
    .filter((film) => {
      if (seen.has(film.id)) return false;
      seen.add(film.id);
      return true;
    })
    .sort((a, b) => filmTitleEn(a).localeCompare(filmTitleEn(b), "en"));

  const items: FilmIndexItem[] = list.map((film) => {
    const douban = doubanRatingOf(film);
    const title = filmTitleEn(film);
    const subtitle = film.title && film.title !== title ? film.title : undefined;
    return {
      id: film.id,
      href: `/en/film/${encodeURIComponent(film.id)}`,
      title,
      subtitle,
      year: film.year,
      douban: douban ? douban.score.toFixed(1) : undefined,
      thumb: thumbFor(film.poster),
      color: film.posterColors?.[0] || "#1a1a2e",
      initials: initials(film.titleEn || title),
      seen: seenTokens({
        id: film.id,
        title: film.title,
        titleEn: film.titleEn,
        year: film.year,
        doubanId: doubanIdOf(film),
      }).join(" "),
      search: [film.title, film.titleEn, title, film.year, ...film.directors, ...film.cast]
        .filter(Boolean)
        .join(" "),
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl text-cinema-text">All films</h1>
      </header>
      <FilmIndex items={items} locale="en" totalLabel="sorted by title" />
    </div>
  );
}
