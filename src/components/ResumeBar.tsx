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

export type NewSinceInfo = {
  /** false for first-time visitors (no marker stored yet) */
  hasBaseline: boolean;
  count: number;
};

function NewSinceLine({ info }: { info: NewSinceInfo }) {
  if (!info.hasBaseline) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-cinema-card px-4 py-3 text-sm ring-1 ring-cinema-border/70">
      <span className={info.count > 0 ? "text-cinema-text" : "text-cinema-muted"}>
        {info.count > 0 ? (
          <>
            自上次来访新增 <span className="font-semibold text-cinema-gold">{info.count}</span> 条
          </>
        ) : (
          "没有新内容 · 你已经看到最新了"
        )}
      </span>
      {info.count > 0 ? (
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-cinema-gold hover:underline"
          onClick={() => {
            const el = document.querySelector("[data-last-seen-divider]");
            if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
        >
          跳到上次看到这里 ↓
        </button>
      ) : null}
    </div>
  );
}

export default function ResumeBar({
  items,
  newSince,
}: {
  items: ResumeItem[];
  newSince?: NewSinceInfo | null;
}) {
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

  const line = ready && newSince ? <NewSinceLine info={newSince} /> : null;
  if (!ready || !lastId) return line;
  const blocked = dismissStore.blocked || {};
  if (blocked[lastId]) return line;

  const i = items.findIndex((x) => x.id === lastId);
  if (i < 0) return line;
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
    <>
    {line}
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
    </>
  );
}
