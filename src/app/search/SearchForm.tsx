"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索影片、人物、奖项…"
        className="flex-1 rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 text-cinema-text outline-none placeholder:text-cinema-muted focus:border-cinema-gold/50"
        autoFocus
      />
      <button
        type="submit"
        className="rounded-xl bg-cinema-gold px-5 py-3 text-sm font-medium text-cinema-bg hover:bg-cinema-gold-light"
      >
        搜索
      </button>
    </form>
  );
}
