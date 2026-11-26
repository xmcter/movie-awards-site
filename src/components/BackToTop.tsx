"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isEnPath } from "@/lib/i18n";

/**
 * 回到顶部（2026-11-26 ui-unify）：与 readcine.com/shared 的 .rc-totop、ai / blog 同一规格——
 * 44px 圆形玻璃按钮，右下角（避开安全区），滚动超过 400px 出现，平滑回顶（尊重“减少动态效果”）。
 */
export default function BackToTop() {
  const [show, setShow] = useState(false);
  const en = isEnPath(usePathname());
  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      setShow(window.scrollY > 400);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const label = en ? "Back to top" : "回到顶部";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={show ? 0 : -1}
      aria-hidden={show ? undefined : true}
      className={`rc-totop${show ? " is-visible" : ""}`}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M5 14.5 12 8l7 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
