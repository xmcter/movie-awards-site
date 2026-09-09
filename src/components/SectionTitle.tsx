import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}

export default function SectionTitle({
  title,
  subtitle,
  href,
  linkLabel = "查看全部",
}: Props) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl text-cinema-text sm:text-2xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-cinema-muted">{subtitle}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-sm text-cinema-gold hover:text-cinema-gold-light"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
