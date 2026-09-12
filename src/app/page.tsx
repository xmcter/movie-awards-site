import Timeline from "@/components/Timeline";
import PullToRefresh from "@/components/PullToRefresh";
import { getTimelineEvents } from "@/lib/data";

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
              Festivals · Awards · Auteur · Timeline
            </p>
            <h1 className="mt-3 font-display text-3xl leading-snug text-cinema-text sm:text-4xl">
              银幕奖讯时间线
            </h1>
            <p className="mt-3 max-w-xl text-sm text-cinema-muted sm:text-base">
              主跟 FIAPF A
              类电影节入围、获奖与流媒体；同时收录奥斯卡、金球、金马、金像，以及作者性明确的导演影讯。
            </p>
          </div>
        </section>

        <Timeline events={events} />
      </div>
    </PullToRefresh>
  );
}
