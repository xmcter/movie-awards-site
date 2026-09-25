"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isClicked, readLastId } from "@/lib/readProgress";
import {
  DISMISS_EVENT_NAME,
  loadDismissMarks,
  type DismissStore,
} from "@/lib/dismiss";

export type ResumeItem = {
  id: string;
  title: string;
};

export default function ResumeBar({ items }: { items: ResumeItem[] }) {
  const [lastId, setLastId] = useState("");
  const [dismissStore, setDismissStore] = useState<DismissStore>({ blocked: {} });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLastId(readLastId());
    setDismissStore(loadDismissMarks());
    setReady(true);

    const onDismissUpdate = () => {
      setDismissStore(loadDismissMarks());
    };
    window.addEventListener(DISMISS_EVENT_NAME, onDismissUpdate);
    window.addEventListener("storage", onDismissUpdate);
    return () => {
      window.removeEventListener(DISMISS_EVENT_NAME, onDismissUpdate);
      window.removeEventListener("storage", onDismissUpdate);
    };
  }, []);

  if (!ready || !lastId) return null;
  const blocked = dismissStore.blocked || {};
  if (blocked[lastId]) return null;

  const i = items.findIndex((x) => x.id === lastId);
  if (i < 0) return null;
  const cur = items[i];
  let next: ResumeItem | undefined;
  for (let j = i + 1; j < items.length; j++) {
    if (!blocked[items[j].id]) {
      next = items[j];
      break;
    }
  }
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
