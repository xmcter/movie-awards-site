import Link from "next/link";
import FilmCard from "@/components/FilmCard";
import SectionTitle from "@/components/SectionTitle";
import { AwardBadge, StatusBadge } from "@/components/Badge";
import {
  getRecentWinners,
  getSoonOnStreaming,
  getUpcomingCeremonies,
  films,
} from "@/lib/data";
import { PLATFORM_LABELS, formatDate } from "@/lib/labels";

export default function HomePage() {
  const winners = getRecentWinners(8);
  const upcoming = getUpcomingCeremonies(4);
  const streaming = getSoonOnStreaming(6);
  const featured = films.slice(0, 4);

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 20% 20%, #c9a22733, transparent 50%), radial-gradient(ellipse at 80% 80%, #d4a57422, transparent 45%)",
          }}
        />
        <div className="relative px-6 py-12 sm:px-10 sm:py-16">
          <p className="text-sm uppercase tracking-[0.2em] text-cinema-gold">
            Cinema Awards Desk
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl leading-snug text-cinema-text sm:text-4xl">
            电影获奖资讯 · 提名、桂冠与上线日程
          </h1>
          <p className="mt-4 max-w-xl text-cinema-muted">
            覆盖奥斯卡、金球、戛纳、威尼斯、柏林，以及金马、金像、华表。一站查看获奖纪录与流媒体预计上线时间。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/awards"
              className="rounded-full bg-cinema-gold px-5 py-2.5 text-sm font-medium text-cinema-bg hover:bg-cinema-gold-light"
            >
              浏览奖项
            </Link>
            <Link
              href="/streaming"
              className="rounded-full border border-cinema-border px-5 py-2.5 text-sm text-cinema-text hover:border-cinema-gold/50"
            >
              流媒体日历
            </Link>
          </div>
        </div>
      </section>

      {/* Recent winners */}
      <section>
        <SectionTitle
          title="近期获奖"
          subtitle="各大奖项最新桂冠一览"
          href="/awards"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {winners.map((w, i) => (
            <Link
              key={`${w.film.id}-${w.ceremony.id}-${w.categoryName}-${i}`}
              href={`/films/${w.film.id}`}
              className="flex items-start gap-3 rounded-xl border border-cinema-border bg-cinema-card p-4 transition hover:border-cinema-gold/40"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-display text-white/80"
                style={{
                  background: `linear-gradient(135deg, ${w.film.posterColors?.[0] || "#1c1c1f"}, ${w.film.posterColors?.[1] || "#2a2a2e"})`,
                }}
              >
                {w.film.title.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-cinema-text">
                    {w.film.title}
                  </span>
                  <AwardBadge result="won" />
                </div>
                <p className="mt-1 text-sm text-cinema-muted">
                  {w.org.name} · {w.categoryName}
                </p>
                <p className="text-xs text-cinema-muted/80">
                  {w.ceremony.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming ceremonies */}
      <section>
        <SectionTitle
          title="典礼氛围"
          subtitle="即将或近期举行的颁奖盛典"
          href="/awards"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {upcoming.map(({ ceremony, org }) => (
            <Link
              key={ceremony.id}
              href={`/awards/${org.id}/${ceremony.id}`}
              className="rounded-xl border border-cinema-border bg-cinema-card p-5 transition hover:border-cinema-gold/40"
            >
              <div
                className="mb-3 h-1 w-10 rounded-full"
                style={{ backgroundColor: org.accentColor }}
              />
              <h3 className="font-display text-cinema-text">{org.name}</h3>
              <p className="mt-1 text-sm text-cinema-muted">{ceremony.name}</p>
              <p className="mt-3 text-xs text-cinema-gold">
                {ceremony.date ? formatDate(ceremony.date) : `${ceremony.year}年`}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Soon on streaming */}
      <section>
        <SectionTitle
          title="即将上线"
          subtitle="获奖影片流媒体日程"
          href="/streaming"
        />
        <div className="overflow-hidden rounded-xl border border-cinema-border">
          <ul className="divide-y divide-cinema-border">
            {streaming.map(({ film, release }, i) => (
              <li key={`${film.id}-${release.platform}-${i}`}>
                <Link
                  href={`/films/${film.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 bg-cinema-card px-4 py-3 transition hover:bg-cinema-elevated sm:px-5"
                >
                  <div>
                    <span className="font-medium text-cinema-text">
                      {film.title}
                    </span>
                    <span className="ml-2 text-sm text-cinema-muted">
                      {PLATFORM_LABELS[release.platform]}
                      {release.region ? ` · ${release.region}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={release.status} />
                    <span className="text-sm text-cinema-muted">
                      {formatDate(release.date)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured films */}
      <section>
        <SectionTitle title="精选影片" subtitle="本站收录的部分作品" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.map((film) => (
            <FilmCard key={film.id} film={film} />
          ))}
        </div>
      </section>
    </div>
  );
}
