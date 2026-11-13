import type { Metadata } from "next";
import Timeline from "@/components/Timeline";
import PullToRefresh from "@/components/PullToRefresh";
import { getTimelineEvents } from "@/lib/data";
import { bilingualAlternatesEn, SITE_DESCRIPTION_EN } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Screen News — New film streaming dates & release updates",
  description:
    SITE_DESCRIPTION_EN,
  keywords: [
    "streaming dates",
    "new film releases",
    "new films streaming",
    "film news",
    "streaming premieres",
    "auteur cinema",
    "Netflix",
    "Apple TV+",
    "MUBI",
    "Criterion",
  ],
  alternates: bilingualAlternatesEn("/en"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://news.readcine.com/en",
    siteName: "Screen News",
    title: "Screen News — New film streaming dates & release updates",
    description:
      SITE_DESCRIPTION_EN,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Screen News — New film streaming dates & release updates",
    description:
      SITE_DESCRIPTION_EN,
    images: ["/og.png"],
  },
};

export default function HomePageEn() {
  const events = getTimelineEvents("en");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Screen News",
    url: "https://news.readcine.com/en",
    description:
      SITE_DESCRIPTION_EN,
    inLanguage: "en-US",
  };

  return (
    <PullToRefresh locale="en">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="space-y-8">
        <Timeline events={events} locale="en" />
      </div>
    </PullToRefresh>
  );
}
