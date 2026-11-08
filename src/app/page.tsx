import type { Metadata } from "next";
import Timeline from "@/components/Timeline";
import PullToRefresh from "@/components/PullToRefresh";
import { getTimelineEvents } from "@/lib/data";
import { bilingualAlternates } from "@/lib/i18n";

export const metadata: Metadata = {
  alternates: bilingualAlternates("/"),
};

export default function HomePage() {
  const events = getTimelineEvents();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "银幕新讯",
    url: "https://news.readcine.com",
    description:
      "只做两件事：作者向与高口碑新片的流媒体定档时间，以及新片发行动态。今晚看什么，不收院线爆米花。",
    inLanguage: "zh-CN",
  };

  return (
    <PullToRefresh>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="space-y-8">
        <Timeline events={events} />
      </div>
    </PullToRefresh>
  );
}
