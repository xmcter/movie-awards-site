"use client";

import Link from "next/link";
import type { StreamingPlatform } from "@/types";
import { PLATFORM_LABELS } from "@/lib/labels";

export default function StreamingFilter({
  platforms,
  current,
}: {
  platforms: StreamingPlatform[];
  current?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/streaming"
        className={`rounded-full px-3 py-1.5 text-sm transition ${
          !current
            ? "bg-cinema-gold text-cinema-bg"
            : "border border-cinema-border text-cinema-muted hover:text-cinema-text"
        }`}
      >
        全部
      </Link>
      {platforms.map((p) => (
        <Link
          key={p}
          href={`/streaming?platform=${p}`}
          className={`rounded-full px-3 py-1.5 text-sm transition ${
            current === p
              ? "bg-cinema-gold text-cinema-bg"
              : "border border-cinema-border text-cinema-muted hover:text-cinema-text"
          }`}
        >
          {PLATFORM_LABELS[p]}
        </Link>
      ))}
    </div>
  );
}
