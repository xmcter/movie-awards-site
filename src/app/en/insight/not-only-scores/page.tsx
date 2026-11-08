import type { Metadata } from "next";
import Link from "next/link";
import { bilingualAlternatesEn } from "@/lib/i18n";

const title = "Not Only Scores: On Watching and Rewatching";
const description =
  "Screen News · A note: ratings are references, not destinations — how to use them well, and how to let a film settle.";

export const metadata: Metadata = {
  title,
  description,
  alternates: bilingualAlternatesEn("/en/insight/not-only-scores"),
  openGraph: {
    title,
    description,
    url: "https://news.readcine.com/en/insight/not-only-scores",
    type: "article",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
  },
};

export default function InsightNotOnlyScoresPageEn() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-cinema-muted">
        <Link href="/en" className="hover:text-cinema-gold">
          ← Timeline
        </Link>
      </p>

      <header className="rounded-2xl border border-cinema-border bg-cinema-card px-6 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cinema-gold">
          Screen News · A note
        </p>
        <h1 className="mt-2 font-display text-2xl leading-snug text-cinema-text sm:text-3xl">
          Not Only Scores: On Watching and Rewatching
        </h1>
        <p className="mt-3 text-sm text-cinema-muted">
          A few words from the editors — how we think about ratings, and how to get more out of a film.
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
          Ratings are useful. They tell us what other people think, they help us sort a long
          watchlist, and they make it easier to talk about films. But they are not a verdict,
          and they are not the whole story.
        </p>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            1 · A score is a summary; a film is an experience
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            A number like 8.4 flattens hundreds of hours of craft into a single digit. It cannot
            tell you what a film sounds like, how it moves, or what it feels like to sit with it
            for two hours. Two films with the same score can be entirely different experiences.
          </p>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            When we publish a rating, we treat it as a reference point — one data point among
            many, not a destination.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            2 · Who rated it matters as much as the number
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            A festival jury, a critics&apos; poll and a general audience rarely agree, and that is
            fine. Each group watches differently: juries reward ambition, critics reward form,
            audiences reward feeling. Knowing who is behind a number helps you read it properly.
          </p>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            That is why we try to say where a score comes from — Douban, IMDb, a festival, a
            critics&apos; survey — instead of presenting a bare figure.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            3 · Time changes a film
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            Some films arrive too early. A work that puzzled audiences on release can look
            prophetic ten years later; a crowd-pleaser can fade once its moment passes. Scores
            drift with time, fashion and context.
          </p>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            A film you did not connect with at twenty may speak to you at forty. The film has
            not changed — you have. That is not a flaw in the film; it is how watching works.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            4 · Rewatching is part of watching
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            The first viewing is for the story. The second is for the craft: the editing rhythm,
            the sound design, the way a shot is held a beat longer than you expected. Many of the
            films we love most only reveal themselves on a second or third viewing.
          </p>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            If a film stays with you after the credits — even if you are not sure why — give it
            another chance. The second viewing is often the real one.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            5 · How we use scores here
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>As a sorting aid, not a verdict — a way to find candidates, not to close a case.</li>
            <li>With the source named, so you can judge the number for yourself.</li>
            <li>Alongside context: who made it, what it is about, when it streams, and what the guide says about watching it.</li>
          </ul>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            Watch widely, trust your own eyes, and let the films you love earn their place —
            not because a number told you to, but because they stayed with you.
          </p>
        </div>
      </section>
    </div>
  );
}
