import type { MetadataRoute } from "next";
import { FILM_ALIASES, films, getTimelineEvents, isIndexableFilm } from "@/lib/data";
import { isIndexableFilmEn } from "@/lib/i18n";

export const dynamic = "force-static";

/** 取一组 ISO 时间里最晚的一个（ISO 字符串可直接按字典序比大小）。 */
function latestIso(values: (string | undefined)[]): string | undefined {
  let best: string | undefined;
  for (const v of values) {
    if (v && (!best || v > best)) best = v;
  }
  return best;
}

/** 影片页 lastmod：取其流媒体条目里最晚的入库时间（publishedAt）。 */
function filmLastModified(film: (typeof films)[number]): string | undefined {
  return latestIso(film.streaming.map((s) => s.publishedAt));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const uniqueFilmIds = [
    ...new Set(
      films.filter((film) => isIndexableFilm(film)).map((film) => film.id).filter((id) => !(id in FILM_ALIASES)),
    ),
  ];
  const uniqueFilmIdsEn = [
    ...new Set(
      films.filter((film) => isIndexableFilmEn(film)).map((film) => film.id).filter((id) => !(id in FILM_ALIASES)),
    ),
  ];
  const uniqueEventIds = [
    ...new Set(getTimelineEvents().map((event) => event.id)),
  ];
  const uniqueEventIdsEn = [
    ...new Set(getTimelineEvents("en").map((event) => event.id)),
  ];

  const filmById = new Map(films.map((film) => [film.id, film] as const));
  const eventsZh = getTimelineEvents();
  const eventsEn = getTimelineEvents("en");
  const eventById = new Map(
    [...eventsZh, ...eventsEn].map((event) => [event.id, event] as const),
  );
  // 首页 / 列表页 lastmod：全站最新一条时间线的发布时间。
  const siteLastModified = latestIso([
    ...eventsZh.map((event) => event.publishedAt),
    ...eventsEn.map((event) => event.publishedAt),
  ]);

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: "https://news.readcine.com",
      lastModified: siteLastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://news.readcine.com/about",
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://news.readcine.com/contact",
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://news.readcine.com/privacy",
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: "https://news.readcine.com/insight/not-only-scores",
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://news.readcine.com/films",
      lastModified: siteLastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "https://news.readcine.com/coming-soon",
      lastModified: siteLastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "https://news.readcine.com/en",
      lastModified: siteLastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://news.readcine.com/en/about",
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://news.readcine.com/en/contact",
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://news.readcine.com/en/privacy",
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: "https://news.readcine.com/en/insight/not-only-scores",
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://news.readcine.com/en/films",
      lastModified: siteLastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "https://news.readcine.com/en/coming-soon",
      lastModified: siteLastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  const filmUrls: MetadataRoute.Sitemap = uniqueFilmIds.map((id) => ({
    url: `https://news.readcine.com/film/${encodeURIComponent(id)}`,
    lastModified: filmById.get(id)
      ? filmLastModified(filmById.get(id)!)
      : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const filmUrlsEn: MetadataRoute.Sitemap = uniqueFilmIdsEn.map((id) => ({
    url: `https://news.readcine.com/en/film/${encodeURIComponent(id)}`,
    lastModified: filmById.get(id)
      ? filmLastModified(filmById.get(id)!)
      : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const eventUrls: MetadataRoute.Sitemap = uniqueEventIds.map((id) => ({
    url: `https://news.readcine.com/event/${encodeURIComponent(id)}`,
    lastModified: eventById.get(id)?.publishedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const eventUrlsEn: MetadataRoute.Sitemap = uniqueEventIdsEn.map((id) => ({
    url: `https://news.readcine.com/en/event/${encodeURIComponent(id)}`,
    lastModified: eventById.get(id)?.publishedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticUrls, ...filmUrls, ...filmUrlsEn, ...eventUrls, ...eventUrlsEn];
}
