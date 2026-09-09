import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { films, getFilm, getFilmAwards } from "@/lib/data";
import PosterPlaceholder from "@/components/PosterPlaceholder";
import { AwardBadge, StatusBadge } from "@/components/Badge";
import { PLATFORM_LABELS, formatDate } from "@/lib/labels";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return films.map((f) => ({ id: f.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const film = getFilm(id);
  return { title: film?.title || "影片" };
}

export default async function FilmPage({ params }: Props) {
  const { id } = await params;
  const film = getFilm(id);
  if (!film) notFound();

  const awards = getFilmAwards(film.id);
  const wins = awards.filter((a) => a.result === "won");
  const noms = awards.filter((a) => a.result === "nominated");

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <PosterPlaceholder
          title={film.title}
          colors={film.posterColors}
          size="lg"
          className="lg:sticky lg:top-24"
        />

        <div>
          <p className="text-sm text-cinema-gold">{film.year}</p>
          <h1 className="mt-1 font-display text-3xl text-cinema-text sm:text-4xl">
            {film.title}
          </h1>
          {film.titleEn && (
            <p className="mt-1 text-lg text-cinema-muted">{film.titleEn}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {film.genres.map((g) => (
              <span
                key={g}
                className="rounded-full border border-cinema-border px-3 py-0.5 text-xs text-cinema-muted"
              >
                {g}
              </span>
            ))}
            {film.runtime && (
              <span className="rounded-full border border-cinema-border px-3 py-0.5 text-xs text-cinema-muted">
                {film.runtime} 分钟
              </span>
            )}
          </div>

          <p className="mt-6 leading-relaxed text-cinema-muted">{film.synopsis}</p>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-cinema-muted">导演</dt>
              <dd className="mt-0.5 text-cinema-text">
                {film.directors.join("、")}
              </dd>
            </div>
            <div>
              <dt className="text-cinema-muted">主演</dt>
              <dd className="mt-0.5 text-cinema-text">{film.cast.join("、")}</dd>
            </div>
            {film.country && (
              <div>
                <dt className="text-cinema-muted">制片地区</dt>
                <dd className="mt-0.5 text-cinema-text">
                  {film.country.join("、")}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Awards record */}
      <section className="mt-12">
        <h2 className="font-display text-xl text-cinema-text">获奖纪录</h2>
        <p className="mt-1 text-sm text-cinema-muted">
          {wins.length} 项获奖 · {noms.length} 项提名
        </p>

        {awards.length === 0 ? (
          <p className="mt-4 text-cinema-muted">暂无奖项纪录</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {awards.map((a, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cinema-border bg-cinema-card px-4 py-3"
              >
                <div>
                  <Link
                    href={`/awards/${a.org.id}/${a.ceremony.id}`}
                    className="font-medium text-cinema-text hover:text-cinema-gold-light"
                  >
                    {a.ceremony.name}
                  </Link>
                  <p className="text-sm text-cinema-muted">
                    {a.org.name} · {a.categoryName}
                    {a.personNames?.length
                      ? ` · ${a.personNames.join("、")}`
                      : ""}
                  </p>
                </div>
                <AwardBadge result={a.result} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Streaming */}
      <section className="mt-12">
        <h2 className="font-display text-xl text-cinema-text">流媒体上线</h2>
        <p className="mt-1 text-sm text-cinema-muted">
          已公布 / 预计 / 待定 · 演示数据，仅供参考
        </p>

        {film.streaming.length === 0 ? (
          <p className="mt-4 text-cinema-muted">暂无流媒体信息</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {film.streaming.map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cinema-border bg-cinema-card px-4 py-3"
              >
                <div>
                  <span className="font-medium text-cinema-text">
                    {PLATFORM_LABELS[s.platform]}
                  </span>
                  {s.region && (
                    <span className="ml-2 text-sm text-cinema-muted">
                      {s.region}
                    </span>
                  )}
                  {s.note && (
                    <p className="mt-0.5 text-xs text-cinema-muted">{s.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  <span className="text-sm text-cinema-muted">
                    {formatDate(s.date)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4">
          <Link
            href="/streaming"
            className="text-sm text-cinema-gold hover:text-cinema-gold-light"
          >
            查看全部流媒体日历 →
          </Link>
        </p>
      </section>
    </div>
  );
}
