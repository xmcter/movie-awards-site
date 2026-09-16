import Timeline from "@/components/Timeline";
import PullToRefresh from "@/components/PullToRefresh";
import ResumeBar from "@/components/ResumeBar";
import { getTimelineEvents } from "@/lib/data";

export default function HomePage() {
  const events = getTimelineEvents();
  const resumeItems = events.map((e) => ({ id: e.id, title: e.filmTitle }));

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
              New Films · Festivals · Awards
            </p>
            <h1 className="mt-3 font-display text-3xl leading-snug text-cinema-text sm:text-4xl">
              银幕新讯时间线
            </h1>
            <p className="mt-3 max-w-xl text-sm text-cinema-muted sm:text-base">
              收作者向新片的定档、上映与流媒体，以及 A 类电影节、奥斯卡 / 金球 / 金马 / 金像的入围与获奖。
              不收院线爆米花、超级英雄连载和纯票房娱乐片。
            </p>
          </div>
        </section>

        <ResumeBar items={resumeItems} />
        <Timeline events={events} />
      </div>
    </PullToRefresh>
  );
}
