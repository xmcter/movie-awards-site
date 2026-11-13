import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_DESCRIPTION_EN } from "@/lib/i18n";

const keywords = [
  "streaming dates",
  "new film releases",
  "new films streaming",
  "film news",
  "streaming premieres",
  "auteur cinema",
  "Netflix",
  "Apple TV+",
  "MUBI",
  "Criterion",
];

/** English routes override the Chinese defaults from the root layout.
 *  Page-level title, description, and twitter fields still win when set. */
export const metadata: Metadata = {
  description: SITE_DESCRIPTION_EN,
  keywords,
  authors: [{ name: "Screen News" }],
  appleWebApp: {
    capable: true,
    title: "Screen News",
    statusBarStyle: "default",
  },
  openGraph: {
    siteName: "Screen News",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Screen News",
    description: SITE_DESCRIPTION_EN,
    images: ["/og.png"],
  },
};

export default function EnLayout({ children }: { children: ReactNode }) {
  return children;
}
