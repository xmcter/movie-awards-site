"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isClicked, readLastId } from "@/lib/readProgress";

export type ResumeItem = {
  id: string;
  title: string;
};

export default function ResumeBar({ items }: { items: ResumeItem[] }) {
  const [lastId, setLastId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLastId(readLastId());
    setReady(true);
  }, []);

  if (!ready || !lastId) return null;
  const i = items.findIndex((x) => x.id === lastId);
  if (i < 0) return null;
  const cur = items[i];
  const next = items[i + 1];
  const nextRead = next ? isClicked(next.id) : true;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        className="rounded-full border border-cinema-border bg-cinema-card px-3 py-1.5 text-xs text-cinema-muted"
        onClick={() => {
          const el = document.querySelector(`[data-event-id="${CSS.escape(cur.id)}"]`);
          if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
        }}
      >
        上次看到「{cur.title}」
      </button>
      {next ? (
        <Link
          href={`/event/${encodeURIComponent(next.id)}`}
          prefetch={false}
          className={`rounded-full border px-3 py-1.5 text-xs ${
            nextRead
              ? "border-cinema-border text-cinema-muted/70"
              : "border-cinema-gold/40 text-cinema-gold"
          }`}
        >
          {nextRead ? "下一篇已读 · " : "下一篇未读 · "}
          {next.title}
        </Link>
      ) : null}
    </div>
  );
}
