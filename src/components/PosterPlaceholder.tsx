interface Props {
  title: string;
  colors?: [string, string];
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function PosterPlaceholder({
  title,
  colors = ["#1c1c1f", "#2a2a2e"],
  className = "",
  size = "md",
}: Props) {
  const initial = title.slice(0, 1);
  const height =
    size === "sm" ? "h-28" : size === "lg" ? "h-72 sm:h-80" : "h-44";

  return (
    <div
      className={`relative flex ${height} w-full items-end overflow-hidden rounded-lg ${className}`}
      style={{
        background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      <span className="absolute inset-0 flex items-center justify-center text-4xl font-display text-white/25">
        {initial}
      </span>
      <div className="relative z-10 w-full bg-gradient-to-t from-black/70 to-transparent p-3">
        <p className="line-clamp-2 text-sm font-medium text-white">{title}</p>
      </div>
    </div>
  );
}
