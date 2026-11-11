import type { MetadataRoute } from "next";
import { FILM_ALIASES, films, getTimelineEvents, isIndexableFilm } from "@/lib/data";
import { isIndexableFilmEn } from "@/lib/i18n";

export const dynamic = "force-static";

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

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: "https://news.readcine.com",
      changeFrequency: "daily",
      priority: 1,
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
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "https://news.readcine.com/coming-soon",
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "https://news.readcine.com/en",
      changeFrequency: "daily",
      priority: 0.9,
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
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "https://news.readcine.com/en/coming-soon",
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  const filmUrls: MetadataRoute.Sitemap = uniqueFilmIds.map((id) => ({
    url: `https://news.readcine.com/film/${encodeURIComponent(id)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const filmUrlsEn: MetadataRoute.Sitemap = uniqueFilmIdsEn.map((id) => ({
    url: `https://news.readcine.com/en/film/${encodeURIComponent(id)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const eventUrls: MetadataRoute.Sitemap = uniqueEventIds.map((id) => ({
    url: `https://news.readcine.com/event/${encodeURIComponent(id)}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const eventUrlsEn: MetadataRoute.Sitemap = uniqueEventIdsEn.map((id) => ({
    url: `https://news.readcine.com/en/event/${encodeURIComponent(id)}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticUrls, ...filmUrls, ...filmUrlsEn, ...eventUrls, ...eventUrlsEn];
}
