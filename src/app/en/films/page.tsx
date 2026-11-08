import type { Metadata } from "next";
import Link from "next/link";
import { FILM_ALIASES, films, isIndexableFilm } from "@/lib/data";
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
};

export const dynamic = "force-static";

export default function FilmsPageEn() {
  const seen = new Set<string>();
  const list = films
    .filter((film) => isIndexableFilm(film, "en"))
    .filter((film) => !(film.id in FILM_ALIASES))
    .filter((film) => {
      if (seen.has(film.id)) return false;
      seen.add(film.id);
      return true;
    })
    .sort((a, b) => filmTitleEn(a).localeCompare(filmTitleEn(b), "en"));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl text-cinema-text">All films</h1>
        <p className="mt-2 text-sm text-cinema-muted">
          {list.length} films · sorted by title
        </p>
      </header>
      <ul className="space-y-2">
        {list.map((film) => (
          <li
            key={film.id}
            className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3"
          >
            <Link
              href={`/en/film/${encodeURIComponent(film.id)}`}
              className="block text-sm text-cinema-text hover:text-cinema-gold"
            >
              {filmTitleEn(film)}
              <span className="ml-2 text-xs text-cinema-muted">
                {film.year}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
