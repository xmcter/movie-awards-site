import type { Metadata } from "next";
import Link from "next/link";
import { bilingualAlternatesEn } from "@/lib/i18n";

const title = "Contact us";
const description =
  "Contact Screen News (ReadCine editors): corrections, new-film and festival tips, business and site partnerships.";

export const metadata: Metadata = {
  title,
  description,
  alternates: bilingualAlternatesEn("/en/contact"),
  openGraph: {
    title,
    description,
    url: "https://news.readcine.com/en/contact",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Screen News" }],
  },
};

export default function ContactPageEn() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-cinema-muted">
        <Link href="/en" className="hover:text-cinema-gold">
          ← Timeline
        </Link>
      </p>

      <header className="rounded-2xl border border-cinema-border bg-cinema-card px-6 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cinema-gold">
          Contact Us
        </p>
        <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
          Contact us
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-cinema-muted sm:text-base">
          Screen News is maintained and run day to day by the ReadCine editors. You are welcome to reach us by email.
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">Email</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            Contact email:{" "}
            <a
              href="mailto:mloder@qq.com"
              className="font-medium text-cinema-gold underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold-light"
            >
              mloder@qq.com
            </a>
          </p>
          <p className="text-xs text-cinema-muted/80">
            Run by: ReadCine editors (we aim to read and reply to every letter within a few working days).
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">What to write about</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">Corrections: </span>
              if a film title, credit, streaming date or release status on the site is wrong, please include the page link and a reference source — we will check and fix it promptly.
            </li>
            <li>
              <span className="text-cinema-text">News tips: </span>
              tips that fit our editorial standards are welcome: officially announced streaming dates (date + platform + region) and new-film release updates (please attach an official notice, authoritative report or verifiable source link).
            </li>
            <li>
              <span className="text-cinema-text">Partnerships: </span>
              for link exchanges, republication permission, advertising or other business enquiries, please state the purpose in the email subject.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
