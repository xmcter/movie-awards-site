/** English pages keep the account name and replace the Chinese prefix. */
function weiboTitle(label: string | undefined, locale: "zh" | "en"): string {
  if (!label) return locale === "en" ? "View the original Weibo post" : "查看微博原帖";
  if (locale !== "en") return label;
  const rest = label.replace(/^微博\s*[·・•.]?\s*/, "");
  if (rest !== label) return rest ? `Weibo · ${rest}` : "Weibo";
  return label;
}

/** Only expose verified Weibo web URLs, never arbitrary data-driven links. */
export default function WeiboLink({
  href,
  label,
  locale = "zh",
}: {
  href?: string;
  label?: string;
  locale?: "zh" | "en";
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
  const title = weiboTitle(label, locale);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-cinema-border/70 bg-cinema-card px-2 py-0.5 text-[10px] text-cinema-muted transition hover:border-cinema-gold/40 hover:text-cinema-text"
    >
      <span>{locale === "en" ? "Weibo" : "微博"}</span>
      <span className="text-[9px] opacity-70">↗</span>
    </a>
  );
}
