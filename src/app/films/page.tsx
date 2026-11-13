import type { Metadata } from "next";
import Link from "next/link";
import { FILM_ALIASES, films } from "@/lib/data";
import { bilingualAlternates } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "全部影片",
  description: "本站收录的全部影片档，按片名排列。",
  alternates: bilingualAlternates("/films"),
};

export const dynamic = "force-static";

export default function FilmsPage() {
  const seen = new Set<string>();
  // 显示口径与「纳入索引」分开：这里列全部有影片页的片子（含剧情不足 40 字的
  // 薄目录页，如《爬行者》《潜伏6》）；isIndexableFilm 只留给 sitemap/robots 用。
  const list = films
    .filter((film) => !(film.id in FILM_ALIASES))
    .filter((film) => {
      if (seen.has(film.id)) return false;
      seen.add(film.id);
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl text-cinema-text">全部影片</h1>
        <p className="mt-2 text-sm text-cinema-muted">
          共 {list.length} 部 · 按片名排列
        </p>
      </header>
      <ul className="space-y-2">
        {list.map((film) => (
          <li
            key={film.id}
            className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3"
          >
            <Link
              href={`/film/${encodeURIComponent(film.id)}`}
              className="block text-sm text-cinema-text hover:text-cinema-gold"
            >
              {film.title}
              {film.titleEn ? (
                <span className="text-cinema-muted"> / {film.titleEn}</span>
              ) : null}
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
