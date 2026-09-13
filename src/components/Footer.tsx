export default function Footer() {
  return (
    <footer className="mt-16 border-t border-cinema-border bg-cinema-card">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="font-display text-cinema-gold">银幕奖讯</p>
        <p className="mt-1 text-sm text-cinema-muted">
          A类电影节 · 奥斯卡 / 金球 / 金马 / 金像 · 作者 · 流媒体
        </p>
        <p className="mt-3 text-xs text-cinema-muted/70">
          时间线只挂已发生的消息日；数据随仓库发布，非实时爬取。
        </p>
        <p className="mt-3 text-xs text-cinema-muted/70">
          <a
            href="https://go.readcine.com"
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
      </div>
    </footer>
  );
}
