"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface FilmIndexItem {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  year: number;
  douban?: string;
  thumb?: string;
  color: string;
  initials: string;
  seen: string;
  search: string;
}

function RowPoster({ item }: { item: FilmIndexItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md"
      style={{ background: item.color }}
    >
      {item.thumb && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumb}
          alt=""
          width={40}
          height={56}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-[11px] text-white/85">
          {item.initials}
        </span>
      )}
    </span>
  );
}

export default function FilmIndex({
  items,
  locale,
  totalLabel,
}: {
  items: FilmIndexItem[];
  locale: "zh" | "en";
  totalLabel: string;
}) {
  const en = locale === "en";
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!q) return items;
    return items.filter((item) => item.search.toLowerCase().includes(q));
  }, [items, q]);

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-40 -mx-4 bg-cinema-bg/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={en ? "Search title, director, cast" : "搜索片名、导演、演员"}
          aria-label={en ? "Search films" : "搜索影片"}
          autoComplete="off"
          className="w-full rounded-full border border-cinema-border/70 bg-cinema-card px-3 py-2 text-sm text-cinema-text placeholder:text-cinema-muted/60 focus:border-cinema-gold/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cinema-gold"
        />
      </div>
      <p className="text-sm text-cinema-muted">
        {q
          ? en
            ? `${shown.length} of ${items.length} · ${totalLabel}`
            : `找到 ${shown.length} / ${items.length} 部 · ${totalLabel}`
          : en
            ? `${items.length} films · ${totalLabel}`
            : `共 ${items.length} 部 · ${totalLabel}`}
      </p>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cinema-border px-4 py-10 text-center text-sm text-cinema-muted">
          {en ? "No films match" : "没有匹配的影片"}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <li key={item.id} data-rc-fk={item.seen}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-xl border border-cinema-border bg-cinema-card px-3 py-2.5 transition hover:border-cinema-gold/40"
              >
                <RowPoster item={item} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-cinema-text">{item.title}</span>
                  {item.subtitle ? (
                    <span className="mt-0.5 block truncate text-xs text-cinema-muted">{item.subtitle}</span>
                  ) : null}
                  <span className="mt-1 block text-xs text-cinema-muted">
                    {item.year}
                    {item.douban ? (
                      <span className="ml-2 tabular-nums" data-douban-rating={item.douban}>
                        ⭐ {item.douban} {en ? "Douban" : "豆瓣"}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
