import type { MetadataRoute } from "next";
import { FILM_ALIASES, films, getTimelineEvents } from "@/lib/data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const uniqueFilmIds = [
    ...new Set(
      films.map((film) => film.id).filter((id) => !(id in FILM_ALIASES)),
    ),
  ];
  const uniqueEventIds = [
    ...new Set(getTimelineEvents().map((event) => event.id)),
  ];

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: "https://news.readcine.com",
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://news.readcine.com/about",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://news.readcine.com/contact",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://news.readcine.com/privacy",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const filmUrls: MetadataRoute.Sitemap = uniqueFilmIds.map((id) => ({
    url: `https://news.readcine.com/film/${id}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const eventUrls: MetadataRoute.Sitemap = uniqueEventIds.map((id) => ({
    url: `https://news.readcine.com/event/${id}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticUrls, ...filmUrls, ...eventUrls];
}
