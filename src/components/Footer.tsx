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
      </div>
    </footer>
  );
}
