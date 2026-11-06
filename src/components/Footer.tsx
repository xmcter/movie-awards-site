import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-cinema-border bg-cinema-card">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="font-display text-cinema-gold">银幕新讯</p>
        <p className="mt-1 text-sm text-cinema-muted">
          新片流媒体定档 · 出资源通知（中字熟肉 / 网盘可下）
        </p>
        <p className="mt-3 text-xs text-cinema-muted/70">
          只关心什么时候能在流媒体看、什么时候出资源；不收院线爆米花。数据随仓库发布，非实时爬取。
        </p>
        <p className="mt-3 text-xs text-cinema-muted/70">
          <Link
            href="/about"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
          >
            关于
          </Link>
          <span className="mx-2 opacity-40">·</span>
          <Link
            href="/contact"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
          >
            联系
          </Link>
          <span className="mx-2 opacity-40">·</span>
          <Link
            href="/privacy"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
          >
            隐私政策
          </Link>
        </p>
        <p className="mt-2 text-xs text-cinema-muted/70">
          <a
            href="https://readcine.com"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
          >
            readcine 导航
          </a>
          <span className="mx-2 opacity-40">·</span>
          <a
            href="https://news.readcine.com"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
          >
            news.readcine.com
          </a>
        </p>
        <p className="mt-2 text-xs text-cinema-muted/70">
          © 2026 ReadCine 编辑部
        </p>
      </div>
    </footer>
  );
}
