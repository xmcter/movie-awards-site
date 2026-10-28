import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ThemeInit from "@/components/ThemeInit";
import "./globals.css";

const siteUrl = "https://news.readcine.com";
const title = "银幕新讯 · 高口碑新片与熟肉上线雷达";
const description =
  "聚焦优质作者新片、节展口碑佳作的流媒体首播、蓝光压制与熟肉资源动态。今晚看什么，不收院线爆米花。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · 银幕新讯",
  },
  description,
  keywords: [
    "高口碑电影",
    "新片上线",
    "熟肉资源",
    "流媒体首播",
    "Criterion",
    "MUBI",
    "Netflix",
    "电影导赏",
    "电影节获奖",
    "作者电影",
    "戛纳",
    "威尼斯",
  ],
  authors: [{ name: "银幕新讯" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: siteUrl,
    siteName: "银幕新讯",
    title,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "银幕新讯" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "银幕新讯",
  url: siteUrl,
  description,
  inLanguage: "zh-CN",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeInit />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <Footer />
        <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "14344261ed76415c8ed6b3d387441550"}' />
      </body>
    </html>
  );
}
