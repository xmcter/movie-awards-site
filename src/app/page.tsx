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
        <section className="relative overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at 20% 20%, #c9a22733, transparent 50%), radial-gradient(ellipse at 80% 80%, #d4a57422, transparent 45%)",
            }}
          />
          <div className="relative px-6 py-10 sm:px-8 sm:py-12">
            <p className="text-sm uppercase tracking-[0.2em] text-cinema-gold">
              Streaming Radar · Acclaimed Films
            </p>
            <h1 className="mt-3 font-display text-3xl leading-snug text-cinema-text sm:text-4xl">
              高口碑新片与熟肉上线雷达
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-cinema-muted sm:text-base">
              聚焦优质作者新片、节展口碑佳作的流媒体首播、蓝光压制与熟肉资源动态，以及三大节获奖风向。
              告别遥远不可达的排片通告，只告诉你今晚有什么真正的好片值得看。不收商业爆米花。
            </p>
          </div>
        </section>

        <Timeline events={events} />
      </div>
    </PullToRefresh>
  );
}
