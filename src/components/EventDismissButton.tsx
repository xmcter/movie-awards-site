"use client";

import { useEffect, useState } from "react";
import type { TimelineEvent } from "@/types";
import {
  DISMISS_EVENT_NAME,
  isBlockedOrSimilar,
  loadDismissMarks,
  blockEvent,
  unblockEvent,
  type DismissStore,
} from "@/lib/dismiss";

export default function EventDismissButton({
  event,
  className = "",
}: {
  event: TimelineEvent;
  className?: string;
}) {
  const [store, setStore] = useState<DismissStore>({ blocked: {} });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStore(loadDismissMarks());
    setReady(true);

    const onUpdate = () => {
      setStore(loadDismissMarks());
    };
    window.addEventListener(DISMISS_EVENT_NAME, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(DISMISS_EVENT_NAME, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center gap-1 rounded-full border border-cinema-border/50 bg-cinema-card px-2.5 py-1 text-xs text-cinema-muted/40 ${className}`}
      >
        ✕ 不再推荐
      </button>
    );
  }

  const blocked = isBlockedOrSimilar(event, store);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (blocked) {
      unblockEvent(event, store);
    } else {
      blockEvent(event, store);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition active:scale-95 ${
        blocked
          ? "border border-cinema-gold/40 bg-cinema-gold/10 text-cinema-gold hover:bg-cinema-gold/20"
          : "border border-cinema-border bg-cinema-card text-cinema-muted hover:border-cinema-gold/40 hover:text-cinema-text"
      } ${className}`}
      title={blocked ? "撤销屏蔽本条及相关内容" : "不再推荐本条及类似内容"}
    >
      {blocked ? "↩ 撤销屏蔽" : "✕ 不再推荐"}
    </button>
  );
}
