import type { Metadata } from "next";
import Link from "next/link";
import { bilingualAlternatesEn } from "@/lib/i18n";

const title = "About Screen News";
const description =
  "About Screen News (news.readcine.com): streaming dates for quality new films, new-film updates and viewing guides, run by the ReadCine editors.";

export const metadata: Metadata = {
  title,
  description,
  alternates: bilingualAlternatesEn("/en/about"),
  openGraph: {
    title,
    description,
    url: "https://news.readcine.com/en/about",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
  },
};

export default function AboutPageEn() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-cinema-muted">
        <Link href="/en" className="hover:text-cinema-gold">
          ← Timeline
        </Link>
      </p>

      <header className="rounded-2xl border border-cinema-border bg-cinema-card px-6 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cinema-gold">
          About ReadCine News
        </p>
        <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
          About Screen News
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-cinema-muted sm:text-base">
          <strong>Screen News</strong> (news.readcine.com) covers{" "}
          <strong>streaming dates for new films</strong> and{" "}
          <strong>new-film updates</strong>: telling cinephiles when a new film
          becomes available to stream and what is worth knowing about its
          release, with viewing guides. We do not offer downloads, playback or
          access to film files.
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">What this site does</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            The site runs on two tracks: <strong>streaming dates for new films</strong> and{" "}
            <strong>new-film release updates</strong>. <strong>Screen News (news)</strong> publishes
            confirmed streaming dates and release news, while{" "}
            <strong>the viewing guide (guide)</strong> offers spoiler-free background, style
            notes and viewing advice. Every item links to a film page and, where available,
            a guide; items with a verifiable source also link to it. This is a news site
            only — no downloads, playback, or access to film files, and no sign-in.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">Editorial standards</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            To avoid information overload and marketing noise, the editors apply a strict
            &ldquo;few but good&rdquo; rule (see <code className="text-xs text-cinema-gold">EDITORIAL.md</code> in the repo):
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">Selection priority: </span>
              quality first — auteur and acclaimed new films, filtered for filler; no daily quota, newest first.</li>
            <li>
              <span className="text-cinema-text">Track A · Streaming dates for new films: </span>
              confirmed streaming dates (<code className="text-xs">YYYY-MM-DD</code>) and platforms (Netflix / Apple TV+ / Max / Prime Video / Criterion Channel / MUBI / Disney+ / licensed Chinese platforms, etc.) from official or authoritative trade sources, with region and a verifiable source. Focus on auteur, well-crafted new films and festival standouts; awards are not required.
            </li>
            <li>
              <span className="text-cinema-text">Track B · New-film release updates: </span>
              when a high-quality version of a new film officially goes on release (streaming debut, official digital release, etc.), the timeline notes it once with the version and platform; a major new version may earn a second note. Sources are linked when verifiable.
            </li>
            <li>
              <span className="text-cinema-text">Exception: </span>
              a classic&apos;s first 4K / Criterion restoration hitting streaming is covered under Track A.
            </li>
            <li>
              <span className="text-cinema-text">Not covered: </span>
              <strong>the timeline never carries festival / awards / nominations</strong>; no pure commercial blockbusters or superhero serials; no offline-only theatrical openings; no review-score hype, PR score tweaks or box-office noise; no TBA without a firm date; no unsourced release rumours. Release updates currently appear <strong>only on the timeline</strong>.
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">Streaming &amp; verification rules</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            On film pages, streaming entries with a confirmed date come first (nearest first, with platform and region), and undated ones follow, marked &ldquo;TBA&rdquo;.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">Streaming fields: </span>
              only officially confirmed dates (<code className="text-xs">YYYY-MM-DD</code>) and platforms; undated means &ldquo;TBA&rdquo;; regions are stated honestly (a US date is a US date, never presented as global).
            </li>
            <li>
              <span className="text-cinema-text">Sources: </span>
              official monthly lineups from Netflix / Apple TV+ / Max / Prime Video / MUBI / Criterion Channel / Disney+, announcements from Variety, Deadline, The Wrap and other authoritative trade outlets (When To Stream and JustWatch must be cross-checked against an official lineup or trade report), plus ReadCine&apos;s own library records.
            </li>
            <li>
              <span className="text-cinema-text">Updates: </span>
              data ships with the repo, not scraped live; items are ordered by first publication or ingestion time. The timeline does not show dates and is not sorted by streaming date.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">Who runs it</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            The site is independently maintained and run by the{" "}
            <span className="text-cinema-text">ReadCine editors</span>, part of the{" "}
            <a
              href="https://readcine.com"
              className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              readcine.com
            </a>{" "}
            network of film tools and references.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">Corrections</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            We cross-check sources before publishing, but mistakes happen. If you spot an error
            in a title translation, a director or cast credit, an award, or a release date,
            please email{" "}
            <a
              href="mailto:mloder@qq.com"
              className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              mloder@qq.com
            </a>{" "}
            and we will verify and fix it promptly.
          </p>
        </div>
      </section>
    </div>
  );
}
