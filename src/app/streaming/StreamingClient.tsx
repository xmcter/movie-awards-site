"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { getAllStreamingReleases } from "@/lib/data";
import { StatusBadge } from "@/components/Badge";
import { PLATFORM_LABELS, formatDate, formatYearMonth } from "@/lib/labels";
import type { StreamingPlatform } from "@/types";
import StreamingFilter from "./StreamingFilter";

function StreamingContent() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") || undefined;
  const all = useMemo(() => getAllStreamingReleases(), []);
  const platforms = useMemo(
    () =>
      Array.from(new Set(all.map((e) => e.release.platform))) as StreamingPlatform[],
    [all]
  );

  const filtered = platform
    ? all.filter((e) => e.release.platform === platform)
    : all;

  const groups = new Map<string, typeof filtered>();
  for (const entry of filtered) {
    const key = entry.release.date ? entry.release.date.slice(0, 7) : "tba";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "tba") return 1;
    if (b === "tba") return -1;
    return a.localeCompare(b);
  });

  return (
    <>
      <div className="mt-6">
        <StreamingFilter platforms={platforms} current={platform} />
      </div>

      <div className="mt-8 space-y-10">
        {sortedKeys.map((key) => (
          <section key={key}>
            <h2 className="mb-3 font-display text-lg text-cinema-gold">
              {key === "tba" ? "日期待定" : formatYearMonth(`${key}-01`)}
            </h2>
            <ul className="overflow-hidden rounded-xl border border-cinema-border divide-y divide-cinema-border">
              {groups.get(key)!.map(({ film, release }, i) => (
                <li key={`${film.id}-${release.platform}-${i}`}>
                  <Link
                    href={`/films/${film.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 bg-cinema-card px-4 py-3.5 transition hover:bg-cinema-elevated sm:px-5"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-cinema-text">
                        {film.title}
                      </span>
                      <p className="mt-0.5 text-sm text-cinema-muted">
                        {PLATFORM_LABELS[release.platform]}
                        {release.region ? ` · ${release.region}` : ""}
                        {release.note ? ` · ${release.note}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={release.status} />
                      <span className="w-28 text-right text-sm text-cinema-muted">
                        {formatDate(release.date)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="text-cinema-muted">该平台暂无上线纪录</p>
        )}
      </div>
    </>
  );
}

export default function StreamingClient() {
  return (
    <div>
      <h1 className="font-display text-3xl text-cinema-text">流媒体上线</h1>
      <p className="mt-2 text-cinema-muted">
        按预计日期排列 · 可按平台筛选 · 状态含已公布 / 预计 / 待定
      </p>
      <Suspense
        fallback={
          <div className="mt-6 text-sm text-cinema-muted">加载中…</div>
        }
      >
        <StreamingContent />
      </Suspense>
    </div>
  );
}
