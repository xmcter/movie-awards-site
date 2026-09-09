import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-cinema-border bg-cinema-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-cinema-gold">银幕奖讯</p>
          <p className="mt-1 text-sm text-cinema-muted">
            电影提名、获奖与流媒体上线资讯 · 演示数据
          </p>
        </div>
        <div className="flex gap-4 text-sm text-cinema-muted">
          <Link href="/awards" className="hover:text-cinema-text">
            奖项
          </Link>
          <Link href="/streaming" className="hover:text-cinema-text">
            流媒体
          </Link>
          <Link href="/search" className="hover:text-cinema-text">
            搜索
          </Link>
        </div>
      </div>
    </footer>
  );
}
