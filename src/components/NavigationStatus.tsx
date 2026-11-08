"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationStatus() {
  const pathname = usePathname();
  const [target, setTarget] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => { setTarget(null); setSlow(false); }, [pathname]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const a = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      setTarget(url.href); setSlow(false);
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  useEffect(() => {
    if (!target) return;
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [target]);
  if (!target) return null;
  const en = pathname === "/en" || pathname?.startsWith("/en/");
  return <div role="status" aria-live="polite" className="fixed right-3 top-16 z-50 flex items-center gap-2 rounded-lg border border-cinema-border bg-cinema-card px-3 py-2 text-sm text-cinema-text shadow-lg">
    <span className="h-3 w-3 animate-spin rounded-full border-2 border-cinema-gold border-t-transparent" />
    {slow ? (en ? "Loading slowly" : "加载较慢") : (en ? "Opening details…" : "正在打开详情…")}
    {slow ? <a className="underline" href={target} onClick={e => { e.preventDefault(); location.assign(target); }}>{en ? "Reopen" : "重新打开"}</a> : null}
    <button type="button" onClick={() => setTarget(null)} aria-label={en ? "Close loading notice" : "关闭加载提示"}>×</button>
  </div>;
}
