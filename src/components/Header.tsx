import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-cinema-border/80 bg-cinema-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cinema-gold/20 text-sm font-bold text-cinema-gold">
            A
          </span>
          <span className="font-display text-lg tracking-wide text-cinema-text group-hover:text-cinema-gold-light">
            银幕奖讯
          </span>
        </Link>
        <span className="text-xs tracking-wider text-cinema-muted">A类电影节</span>
      </div>
    </header>
  );
}
