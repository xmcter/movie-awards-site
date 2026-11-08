"use client";

import { useEffect, useState, type ReactNode } from "react";
import { loadPrefsSession } from "@/lib/prefs";

/**
 * Private sources switch, gated by Google login.
 *
 * Source attributions (the "来源·XXX" tags on the timeline and event pages,
 * and the reference-sources list on About) only render when the owner is
 * signed in with Google. The sign-in is the existing prefs login
 * (Google Identity Services + the prefs backend, which only allows
 * tonycter@gmail.com). The session is stored in localStorage for 30 days,
 * so the login is remembered across visits — no re-login needed until it
 * expires. Sign in/out from the Header login button.
 *
 * Note: this gates display only. The site is a static export, so the source
 * label/URL are still present in the page's static HTML source (view-source
 * can reveal them). Truly removing them from the public HTML would need a
 * server-side gate, which a static site does not have.
 */
export function useShowSources(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const read = () => setShow(loadPrefsSession() !== null);
    read();
    const onChange = () => read();
    window.addEventListener("prefs-session-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("prefs-session-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return show;
}

/** Renders children only when the owner is signed in with Google. */
export default function ShowSources({ children }: { children: ReactNode }) {
  const show = useShowSources();
  if (!show) return null;
  return <>{children}</>;
}
