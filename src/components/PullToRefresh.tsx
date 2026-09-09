"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 72;
const MAX_PULL = 120;

/**
 * Lightweight mobile pull-to-refresh. Relies on window scroll (body),
 * shows a gold-accent indicator, then full-reloads the static export.
 * Touch-only — desktop no-ops.
 */
export default function PullToRefresh({
  children,
}: {
  children: React.ReactNode;
}) {
  const startY = useRef(0);
  const tracking = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (refreshing) return;
    if (window.scrollY > 2) return;
    tracking.current = true;
    startY.current = e.touches[0]?.clientY ?? 0;
  }, [refreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!tracking.current || refreshing) return;
    if (window.scrollY > 2) {
      tracking.current = false;
      setPull(0);
      return;
    }
    const y = e.touches[0]?.clientY ?? 0;
    const delta = y - startY.current;
    if (delta <= 0) {
      setPull(0);
      return;
    }
    // Resist pull so it feels natural; prevent native overscroll rubber-band fight a bit
    const resisted = Math.min(MAX_PULL, delta * 0.45);
    setPull(resisted);
    if (resisted > 8 && e.cancelable) {
      e.preventDefault();
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(() => {
    if (!tracking.current) return;
    tracking.current = false;
    setPull((current) => {
      if (current >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        // Brief visual beat, then hard reload for static site
        window.setTimeout(() => {
          window.location.reload();
        }, 280);
        return THRESHOLD;
      }
      return 0;
    });
  }, [refreshing]);

  useEffect(() => {
    // Passive false on move so we can preventDefault when pulling
    const opts: AddEventListenerOptions = { passive: false };
    const startOpts: AddEventListenerOptions = { passive: true };
    document.addEventListener("touchstart", onTouchStart, startOpts);
    document.addEventListener("touchmove", onTouchMove, opts);
    document.addEventListener("touchend", onTouchEnd, startOpts);
    document.addEventListener("touchcancel", onTouchEnd, startOpts);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const show = pull > 4 || refreshing;
  const ready = pull >= THRESHOLD || refreshing;

  return (
    <div className="relative">
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-150 ease-out md:hidden"
        style={{ height: show ? Math.max(pull, refreshing ? 56 : 0) : 0 }}
        aria-hidden={!show}
      >
        <div
          className={`flex items-center gap-2 text-sm ${
            ready ? "text-cinema-gold" : "text-cinema-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent ${
              refreshing || ready ? "animate-spin" : ""
            }`}
            style={{
              transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
            }}
          />
          <span>{refreshing ? "刷新中…" : ready ? "松开刷新" : "下拉刷新"}</span>
        </div>
      </div>
      <div
        style={{
          transform: pull > 0 && !refreshing ? `translateY(${pull * 0.15}px)` : undefined,
          transition: pull === 0 ? "transform 150ms ease-out" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
