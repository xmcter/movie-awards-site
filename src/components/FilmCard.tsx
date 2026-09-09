import Link from "next/link";
import type { Film } from "@/types";
import PosterPlaceholder from "./PosterPlaceholder";

export default function FilmCard({ film }: { film: Film }) {
  return (
    <Link
      href={`/films/${film.id}`}
      className="group block overflow-hidden rounded-xl border border-cinema-border bg-cinema-card transition hover:border-cinema-gold/40 hover:shadow-lg hover:shadow-cinema-gold/5"
    >
      <PosterPlaceholder
        title={film.title}
        colors={film.posterColors}
        size="md"
      />
      <div className="p-3">
        <h3 className="font-medium text-cinema-text group-hover:text-cinema-gold-light">
          {film.title}
        </h3>
        <p className="mt-0.5 text-xs text-cinema-muted">
          {film.year}
          {film.titleEn ? ` · ${film.titleEn}` : ""}
        </p>
        <p className="mt-2 line-clamp-2 text-xs text-cinema-muted">
          {film.synopsis}
        </p>
      </div>
    </Link>
  );
}
