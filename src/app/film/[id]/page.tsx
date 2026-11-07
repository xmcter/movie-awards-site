import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import ReleaseLabel from "@/components/ReleaseLabel";
import FilmMeta from "@/components/FilmMeta";
import WeiboLink from "@/components/WeiboLink";
import { notFound } from "next/navigation";
import { TypeBadge } from "@/components/Badge";
import {
  FILM_ALIASES,
  films,
  getFilm,
  getFilmEvents,
  getVerifiedFilmAwards,
  isIndexableFilm,
  splitFilmCopy,
  truncateDescription,
} from "@/lib/data";
import { dedupeSubtitleAgainstTitle, scrubNegativeCopy, stripStreamingBoilerplate } from "@/lib/headlines";
import {
  PLATFORM_LABELS,
  RELEASE_STATUS_LABELS,
  formatDate,
  genreLabels,
} from "@/lib/labels";

export const dynamic = "force-static";

export function generateStaticParams() {
  const uniqueIds = [
    ...new Set([
      ...films.map((film) => film.id),
      ...Object.keys(FILM_ALIASES),
    ]),
  ];
  return uniqueIds.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonicalId = FILM_ALIASES[id];
  if (canonicalId) {
    const targetFilm = getFilm(canonicalId);
    const title = targetFilm
      ? targetFilm.titleEn
        ? `${targetFilm.title} / ${targetFilm.titleEn}`
        : targetFilm.title
      : "页面已迁移";
    const description = targetFilm
      ? truncateDescription(
          splitFilmCopy(targetFilm).plot ||
            splitFilmCopy(targetFilm).background ||
            `${targetFilm.title}（${targetFilm.year}）流媒体定档与影片档。`,
          150,
        )
      : "该影片条目已合并至主页面。";
    return {
      title,
      description,
      robots: {
        index: false,
        follow: true,
      },
      alternates: {
        canonical: `/film/${canonicalId}`,
      },
    };
  }

  const film = getFilm(id);
  if (!film) return { title: "未找到" };
  const title = `${film.title}：剧情简介与影片资讯`;
  const { plot, background } = splitFilmCopy(film);
  const rawDescription =
    [plot, background].filter(Boolean).join(" ") ||
    `${film.title}（${film.year}）流媒体定档与影片档。`;
  const description = truncateDescription(rawDescription, 150);
  return {
    title,
    description,
    robots: { index: isIndexableFilm(film), follow: true },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `/film/${film.id}` },
    openGraph: {
      title: `${film.title} · 银幕新讯`,
      description,
      url: `https://news.readcine.com/film/${film.id}`,
      type: "article",
      images: film.poster ? [{ url: film.poster, alt: film.title }] : [{ url: "/og.png", width: 1200, height: 630, alt: "银幕新讯" }],
    },
  };
}

function initials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const latin = trimmed.match(/[A-Za-z]+/g);
  if (latin && latin.length > 0) {
    return latin.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  }
  return trimmed.slice(0, 2);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg text-cinema-text">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-cinema-muted">{children}</div>
    </section>
  );
}

export default async function FilmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const canonicalId = FILM_ALIASES[id];
  if (canonicalId) {
    const targetFilm = getFilm(canonicalId);
    const targetUrl = `/film/${canonicalId}`;
    return (
      <div className="space-y-6">
        <meta httpEquiv="refresh" content={`0;url=${targetUrl}`} />
        <p className="text-xs text-cinema-muted">
          <Link href="/" className="hover:text-cinema-gold">
            ← 时间线
          </Link>
        </p>
        <section className="rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
          <h1 className="font-display text-xl text-cinema-text sm:text-2xl">
            {targetFilm ? `${targetFilm.title}（条目已合并）` : "影片条目已合并"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-cinema-muted">
            本页面已合并至主档案页，正在为您自动跳转。如浏览器未自动跳转，请点击下方链接访问：
          </p>
          <p className="mt-4">
            <Link
              href={targetUrl}
              className="text-sm font-medium text-cinema-gold underline decoration-cinema-border underline-offset-4 hover:text-cinema-gold-light"
            >
              前往 {targetFilm ? `《${targetFilm.title}》影片档` : targetUrl}（{targetUrl}） →
            </Link>
          </p>
        </section>
      </div>
    );
  }

  const film = getFilm(id);
  if (!film) notFound();

  const events = getFilmEvents(film.id);
  const weiboEvent = events.find((event) => event.weiboUrl);
  const colors = film.posterColors || ["#1a1a2e", "#334155"];
  const { plot, background } = splitFilmCopy(film);
  const verifiedAwards = getVerifiedFilmAwards(film.id);
  const peopleLabel =
    film.directors.length > 0
      ? "导演"
      : film.genres.includes("评审")
        ? "评审"
        : film.genres.includes("荣誉")
          ? "致敬"
          : "导演";

  const guideQuery = [
    film.title,
    film.year,
    film.titleEn,
    film.directors.length > 0 ? film.directors[0] : "",
  ]
    .filter(Boolean)
    .join(" ");
  const guideUrl = `https://guide.readcine.com/?q=${encodeURIComponent(guideQuery)}&pick=1`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: film.title,
    alternateName: film.titleEn,
    dateCreated: String(film.year),
    description: plot || background || `${film.title}（${film.year}）`,
    director: film.directors.map((name) => ({ "@type": "Person", name })),
    inLanguage: "zh-CN",
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": [jsonLd, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "电影资讯", item: "https://news.readcine.com/" }, { "@type": "ListItem", position: 2, name: film.title, item: `https://news.readcine.com/film/${film.id}` }] }] }).replace(/</g, "\\u003c") }}
      />
      <p className="text-xs text-cinema-muted">
        <Link href="/" className="hover:text-cinema-gold">
          ← 时间线
        </Link>
      </p>

      <section className="overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
        <div className="flex flex-row items-start">
          <div
            className="m-4 mr-0 h-[144px] w-[96px] shrink-0 overflow-hidden rounded-md sm:m-5 sm:h-[210px] sm:w-[140px]"
            style={{
              background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
              aspectRatio: "2 / 3",
            }}
          >
            {film.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={film.poster} alt={film.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl text-white/80">
                {initials(film.titleEn || film.title)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 p-4 pl-3 sm:p-6 sm:pl-5">
            <p className="text-xs uppercase tracking-[0.18em] text-cinema-gold">
              {genreLabels(film.genres).join(" · ") || "影片"}
            </p>
            <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
              {film.title}
              <span className="ml-2 font-sans text-base font-normal text-cinema-muted">
                <FilmMeta year={film.year} />
              </span>
            </h1>
            {film.titleEn ? (
              <p className="mt-1 text-sm text-cinema-muted">{film.titleEn}</p>
            ) : null}
            {film.runtime ? (
              <p className="mt-3 text-xs text-cinema-muted/70">
                {[
                  film.runtime ? `${film.runtime} 分钟` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {film.cast.length > 0 || (film.directors.length > 0 && !plot) ? (
        <Section title={film.directors.length > 0 && !plot && film.cast.length > 0 ? "导演与主演" : film.directors.length > 0 && !plot ? "导演" : peopleLabel !== "导演" ? peopleLabel : "主演"}>
          {!plot && film.directors.length > 0 ? (
            <p className="text-cinema-text">
              <span className="text-cinema-muted">导演 </span>
              {film.directors.join("、")}
            </p>
          ) : null}
          {film.cast.length > 0 ? (
            <p className={`${!plot && film.directors.length > 0 ? "mt-2 " : ""}text-sm text-cinema-text`}>
              <span className="text-cinema-muted">{film.directors.length === 0 && (film.genres.includes("荣誉") || film.genres.includes("评审")) ? peopleLabel : "主演"} </span>
              {film.cast.join("、")}
            </p>
          ) : null}
        </Section>
      ) : null}

      {plot ? (
        <Section title="剧情介绍">
          {film.directors.length > 0 ? (
            <p className="mb-3 text-cinema-text">
              <span className="text-cinema-muted">导演 </span>
              {film.directors.join("、")}
            </p>
          ) : null}
          <p>{scrubNegativeCopy(plot)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5 pt-1">
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-cinema-border bg-cinema-card px-3 py-1.5 text-xs text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
            >
              <span>🎞️ 在「观影导赏」查看导赏</span>
              <span className="text-[10px] opacity-70">↗</span>
            </a>
            <WeiboLink href={weiboEvent?.weiboUrl} label={weiboEvent?.weiboLabel} />
          </div>
        </Section>
      ) : null}

      {verifiedAwards.length > 0 ? (
        <Section title="已核实奖项与提名">
          <ul data-film-awards className="space-y-1 break-words text-xs leading-relaxed text-cinema-gold/90">
            {verifiedAwards.map((award) => (
              <li key={`${award.year}-${award.festival}-${award.category}-${award.result}`}>
                <a href={award.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {award.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={award.icon} alt={`${award.festival}标识`} width={16} height={16} className="mr-1.5 inline-block h-4 w-4 shrink-0 rounded-sm bg-white p-px align-text-bottom object-contain" />
                  ) : null}
                  {award.year}年{award.festival} · {award.category} · {award.result === "won" ? "获奖" : "提名"}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {background ? (
        <Section title="创作背景">
          <p>{scrubNegativeCopy(background)}</p>
        </Section>
      ) : null}

      {!plot && !background ? (
        <Section title="延伸阅读">
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-cinema-border bg-cinema-card px-3 py-1.5 text-xs text-cinema-gold transition hover:border-cinema-gold/40 hover:text-cinema-gold-light"
            >
              <span>🎞️ 在「观影导赏」查看导赏</span>
              <span className="text-[10px] opacity-70">↗</span>
            </a>
            <WeiboLink href={weiboEvent?.weiboUrl} label={weiboEvent?.weiboLabel} />
          </div>
        </Section>
      ) : null}

      {film.streaming.length > 0 ? (
        <section>
          <h2 className="font-display text-lg text-cinema-text">流媒体</h2>
          <ul className="mt-3 space-y-2">
            {[...film.streaming]
              .sort((a, b) => {
                if (a.date && b.date) return a.date.localeCompare(b.date);
                if (a.date) return -1;
                if (b.date) return 1;
                return 0;
              })
              .map((release) => {
              // 定档行不展示登录平台名；PLATFORM_LABELS 仅用于剥 note 套话
              const platformLabel = PLATFORM_LABELS[release.platform] || release.platform;
              const status = RELEASE_STATUS_LABELS[release.status]; // announced 为空：直接写日期
              const when = release.date ? formatDate(release.date) : "待定";
              const bits = [status || null, release.date ? `${when}出源` : when].filter(Boolean); // 不展示平台/国别地区
              return (
                <li
                  key={`${release.platform}-${release.date || "tba"}`}
                  className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 text-sm text-cinema-muted"
                >
                  {release.date ? <ReleaseLabel date={release.date} fallback={bits.join(" · ")} /> : bits.join(" · ")}
                  {(() => {
                    const note = stripStreamingBoilerplate(release.note || "", {
                      platform: platformLabel,
                      region: release.region,
                      datePart: when !== "待定" ? when : undefined,
                      filmTitle: film.title,
                    });
                    return note ? `（${note}）` : "";
                  })()}
                  {/* 真实来源仍走时间线/事件页的 sourceLabel；此处不写平台名也不伪造来源 */}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-lg text-cinema-text">本站相关奖项</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-cinema-muted">暂无已发生的时间线事件。</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-xl border border-cinema-border bg-cinema-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-cinema-muted">
                  {event.type !== "streaming" ? <time dateTime={event.date || undefined}>{event.dateLabel}</time> : null}
                  <TypeBadge type={event.type} label={event.badge === "新品" ? "新片" : event.badge} headline={event.headline} />
                </div>
                <p className="mt-1.5 text-sm text-cinema-text">
                  {event.type === "streaming" && event.date ? <ReleaseLabel date={event.date} title={event.filmTitle} fallback={event.headline || event.filmTitle} /> : (event.headline || event.summary)}
                </p>
                {(() => {
                  const title = (event.headline || "").trim();
                  const summary = scrubNegativeCopy(
                    dedupeSubtitleAgainstTitle(title, event.summary || ""),
                  );
                  const detail = scrubNegativeCopy(
                    dedupeSubtitleAgainstTitle(
                      summary || title,
                      dedupeSubtitleAgainstTitle(title, event.detail || ""),
                    ),
                  );
                  return (
                    <>
                      {summary ? (
                        <p className="mt-1 text-xs text-cinema-muted">{summary}</p>
                      ) : null}
                      {detail ? (
                        <p className="mt-1 text-xs text-cinema-muted/70">{detail}</p>
                      ) : null}
                    </>
                  );
                })()}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
