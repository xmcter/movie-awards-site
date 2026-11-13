import type { Metadata } from "next";
import Link from "next/link";
import { bilingualAlternatesEn } from "@/lib/i18n";

const title = "Privacy Policy";
const description =
  "Screen News (news.readcine.com) privacy policy: static hosting, browser local storage keys, third-party services (GitHub Pages) and Google AdSense ad cookie policy.";

export const metadata: Metadata = {
  title,
  description,
  alternates: bilingualAlternatesEn("/en/privacy"),
  openGraph: {
    title: `${title} · Screen News`,
    description,
    url: "https://news.readcine.com/en/privacy",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
  },
};

export default function PrivacyPageEn() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-cinema-muted">
        <Link href="/en" className="hover:text-cinema-gold">
          ← Timeline
        </Link>
      </p>

      <header className="rounded-2xl border border-cinema-border bg-cinema-card px-6 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cinema-gold">
          Privacy Policy
        </p>
        <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-cinema-muted">Effective date: 2026-10-24</p>
        <p className="mt-4 text-sm leading-relaxed text-cinema-muted sm:text-base">
          This privacy policy explains how{" "}
          <a
            href="https://news.readcine.com"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
          >
            Screen News
          </a>{" "}
          (news.readcine.com, &ldquo;this site&rdquo;) handles information when you browse and use it.
          We follow a minimisation principle: we do not store visitors&rsquo; personal identity
          information on our own servers.
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">1. Overview</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            This site is a purely static news site run by the ReadCine editors (hosted on GitHub
            Pages). It offers an owner-only Google sign-in (for the site owner only, used to sync
            block and like preferences); it offers no visitor registration, comments or form
            submissions, and does not actively collect visitors&rsquo; names, email addresses,
            phone numbers or other personal identity information. Only when you email the editors
            yourself do we receive the contact information in your message, which is used solely
            to reply.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            2. Local storage (cookies and localStorage / sessionStorage)
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            To remember your reading progress and interface preferences, this site sets no cookies
            of its own. It only uses{" "}
            <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
              localStorage
            </code>{" "}
            and{" "}
            <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
              sessionStorage
            </code>{" "}
            in your browser to store the following keys. All of this data stays entirely in your
            device&apos;s browser and is never uploaded to our servers:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_last_seen_v1
              </code>{" "}
              (localStorage): the date and entry IDs of the newest timeline cards visible on your
              last visit, used to mark &ldquo;You were here&rdquo; and &ldquo;New&rdquo; on later visits.
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_last_seen_visit_v1
              </code>{" "}
              (sessionStorage): the baseline position for the current visit session (within a 30-minute window),
              so the &ldquo;New&rdquo; markers stay stable when you return from a detail page.
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news-readcine:clicked
              </code>{" "}
              /{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news-readcine:lastId
              </code>{" "}
              /{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news-readcine:listScroll
              </code>{" "}
              (localStorage): the list of entries you have clicked, the most recently clicked entry ID,
              and the timeline scroll position, used to restore your reading state.
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_dismiss_marks_v1
              </code>{" "}
              (localStorage): entries you manually marked &ldquo;not interested / hide&rdquo; and similar blocking rules.
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_dismiss_unblocked_v1
              </code>{" "}
              (localStorage): IDs of blocks you undid on this device, so a cloud sync does not bring back blocks you already removed.
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_dedup_by_film_v1
              </code>{" "}
              (localStorage): the state of the timeline &ldquo;merge by film&rdquo; toggle.
            </li>
            <li>
              Theme preference (day / night mode): the frontend component{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                ThemeInit
              </code>{" "}
              switches the{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                theme-day
              </code>{" "}
              and{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                theme-night
              </code>{" "}
              classes on the{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                &lt;html&gt;
              </code>{" "}
              element automatically based on device local time (06:00–18:00 is day mode). It does not write any localStorage key.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            You can delete all of the above local storage records at any time via your browser&apos;s
            &ldquo;Clear browsing data / Clear site data&rdquo; function.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">3. Third-party services</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">GitHub Pages hosting: </span>
              this site&apos;s static files are hosted on GitHub Pages. When you visit, GitHub&apos;s
              server logs may automatically record your IP address, browser type, visit time and
              requested pages. That handling is governed by the{" "}
              <a
                href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                GitHub Privacy Statement
              </a>
              .
            </li>
            <li>
              <span className="text-cinema-text">Google Fonts: </span>
              this site&apos;s styles do not reference Google Fonts; browsers do not request font
              resources from{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                fonts.googleapis.com
              </code>{" "}
              or{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                fonts.gstatic.com
              </code>
              .
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            4. Advertising and Google AdSense
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            This site may use Google AdSense to display ads to support day-to-day operations:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this site or other websites.
            </li>
            <li>
              Google uses advertising cookies (including DoubleClick / DART cookies) to enable it and its partners to serve ads based on your visits to this site and/or other websites.
            </li>
            <li>
              You can opt out of personalised advertising at any time by visiting{" "}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                Google Ads Settings (adssettings.google.com)
              </a>{" "}
              or{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                www.google.com/settings/ads
              </a>
              ; you can also opt out of third-party vendors&apos; use of cookies for personalised advertising at{" "}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                www.aboutads.info/choices/
              </a>
              . Users in the EU and EEA can also consult{" "}
              <a
                href="https://www.youronlinechoices.eu/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                www.youronlinechoices.eu
              </a>
              .
            </li>
            <li>
              For more details on how Google uses data in its advertising services and partner sites, see{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                Google&apos;s advertising technology policy (policies.google.com/technologies/ads)
              </a>{" "}
              and{" "}
              <a
                href="https://policies.google.com/technologies/partner-sites"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                How Google uses information from sites or apps that use its services (policies.google.com/technologies/partner-sites)
              </a>
              .
            </li>
            <li>
              Besides Google AdSense, the site may in future work with other compliant third-party ad networks; they will be listed here when that happens.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">5. Data retention</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            This site does not store any visitor browsing data on its own servers; browser local
            storage (localStorage / sessionStorage) stays on your device until you clear the
            browser&apos;s site data; third-party infrastructure and service providers (such as GitHub
            and Google) handle related logs or cookies under their own published privacy policies
            and retention periods.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">6. Children&apos;s privacy</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            This site&apos;s content is aimed at general film lovers and industry readers, not at
            children under 13, and it does not knowingly collect any personal information from
            children under 13.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">7. External links</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            This site may contain links to other readcine.com subsites or third-party websites.
            External sites have their own privacy policies, which are not covered by this policy;
            please check the relevant site&apos;s privacy statement when you visit.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">8. Changes to this policy</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            We may revise this privacy policy from time to time as site features or compliance
            requirements change. Updates will be published directly on this page, and the effective
            date at the top will be updated at the same time.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">9. Contact us</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            If you have any questions or suggestions about this privacy policy, please email:
            <a
              href="mailto:mloder@qq.com"
              className="ml-1 underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              mloder@qq.com
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
