import type { Metadata } from "next";
import Timeline from "@/components/Timeline";
import PullToRefresh from "@/components/PullToRefresh";
import { getTimelineEvents } from "@/lib/data";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  const events = getTimelineEvents();

  return (
    <PullToRefresh>
      <div className="space-y-8">
        <Timeline events={events} />
      </div>
    </PullToRefresh>
  );
}
