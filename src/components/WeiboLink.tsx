/** Only expose verified Weibo web URLs, never arbitrary data-driven links. */
export default function WeiboLink({
  href,
  label,
}: {
  href?: string;
  label?: string;
}) {
  if (!href) return null;
  try {
    const url = new URL(href);
    if (
      url.protocol !== "https:" ||
      !["m.weibo.cn", "weibo.com", "www.weibo.com"].includes(url.hostname) ||
      url.username || url.password || url.port
    ) return null;
  } catch {
    return null;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label || "查看微博原帖"}
      className="inline-flex items-center gap-1 rounded-full border border-cinema-border/70 bg-cinema-card px-2 py-0.5 text-[10px] text-cinema-muted transition hover:border-cinema-gold/40 hover:text-cinema-text"
    >
      <span>微博</span>
      <span className="text-[9px] opacity-70">↗</span>
    </a>
  );
}
