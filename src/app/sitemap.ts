import type { MetadataRoute } from "next";
import { films } from "@/lib/data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const filmUrls = films.map((film) => ({
    url: `https://news.readcine.com/film/${film.id}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [
    {
      url: "https://news.readcine.com",
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    ...filmUrls,
  ];
}
