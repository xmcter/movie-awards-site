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
  const [open, setOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");

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
      const next = unblockEvent(event, store);
      setStore(next);
      return;
    }
    setReasonText("");
    setOpen(true);
  };

  const confirm = () => {
    const reason = reasonText.trim();
    if (!reason) return;
    const next = blockEvent(event, store, reason);
    setStore(next);
    setOpen(false);
    setReasonText("");
  };

  return (
    <>
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

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onClick={() => {
            setOpen(false);
            setReasonText("");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-dismiss-reason-title"
            className="w-full max-w-lg rounded-2xl border border-cinema-border bg-cinema-card p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="event-dismiss-reason-title"
              className="font-display text-lg text-cinema-text"
            >
              不再推荐这条？
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-cinema-muted">
              {event.headline || event.filmTitle}
            </p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="说说原因，比如：题材不感兴趣、已经看过、想换个风格……"
              autoFocus
              rows={6}
              className="mt-4 min-h-[160px] w-full resize-y rounded-xl border border-cinema-border/70 bg-cinema-elevated/40 px-4 py-3 text-base leading-relaxed text-cinema-text placeholder:text-cinema-muted/60 focus:border-cinema-gold/60 focus:outline-none"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setReasonText("");
                }}
                className="rounded-full border border-cinema-border/70 px-4 py-2.5 text-sm text-cinema-muted hover:text-cinema-text"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!reasonText.trim()}
                onClick={confirm}
                className="rounded-full border border-cinema-gold/40 bg-cinema-gold/15 px-4 py-2.5 text-sm font-medium text-cinema-gold disabled:opacity-40"
              >
                确认不再推荐
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
