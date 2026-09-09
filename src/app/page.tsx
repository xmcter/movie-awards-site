import Timeline from "@/components/Timeline";
import { getTimelineEvents } from "@/lib/data";

export default function HomePage() {
  const events = getTimelineEvents();

  return (
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
            FIAPF A-list · Timeline
          </p>
          <h1 className="mt-3 font-display text-3xl leading-snug text-cinema-text sm:text-4xl">
            A类电影节时间线
          </h1>
          <p className="mt-3 max-w-xl text-sm text-cinema-muted sm:text-base">
            仅追踪 FIAPF A
            类电影节的入围、获奖与相关流媒体日程。优先三大（戛纳、威尼斯、柏林），兼顾洛迦诺、圣塞、上海、东京、釜山等。宁缺毋滥，不收录奥斯卡、金球、金马、金像、华表等非 A 类奖项。
          </p>
        </div>
      </section>

      <Timeline events={events} />
    </div>
  );
}
