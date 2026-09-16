"use client";

import { useEffect } from "react";

export default function ThemeInit() {
  useEffect(() => {
    const apply = () => {
      const h = new Date().getHours();
      const day = h >= 6 && h < 18;
      document.documentElement.classList.toggle("theme-day", day);
      document.documentElement.classList.toggle("theme-night", !day);
    };
    apply();
    const t = window.setInterval(apply, 10 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);
  return null;
}
