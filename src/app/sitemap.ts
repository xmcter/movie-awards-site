import type { MetadataRoute } from "next";
import { FILM_ALIASES, films, getTimelineEvents, isIndexableFilm } from "@/lib/data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const uniqueFilmIds = [
    ...new Set(
      films.filter(isIndexableFilm).map((film) => film.id).filter((id) => !(id in FILM_ALIASES)),
    ),
  ];
  const uniqueEventIds = [
    ...new Set(getTimelineEvents().map((event) => event.id)),
  ];

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: "https://news.readcine.com",
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
  ];

  const filmUrls: MetadataRoute.Sitemap = uniqueFilmIds.map((id) => ({
    url: `https://news.readcine.com/film/${encodeURIComponent(id)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const eventUrls: MetadataRoute.Sitemap = uniqueEventIds.map((id) => ({
    url: `https://news.readcine.com/event/${encodeURIComponent(id)}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticUrls, ...filmUrls, ...eventUrls];
}
