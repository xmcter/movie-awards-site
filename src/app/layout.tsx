import NavigationStatus from "@/components/NavigationStatus";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ThemeInit from "@/components/ThemeInit";
import "./globals.css";

const siteUrl = "https://news.readcine.com";
const title = "电影资讯";
const description =
  "只做两件事：作者向与高口碑新片的流媒体定档时间，以及新片出资源（中字熟肉/网盘可下）通知。今晚看什么，不收院线爆米花。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s",
  },
  description,
  keywords: [
    "流媒体定档",
    "出资源通知",
    "新片上线",
    "熟肉资源",
    "流媒体首播",
    "网盘可下",
    "高口碑电影",
    "作者电影",
    "Netflix",
    "Apple TV+",
    "MUBI",
    "Criterion",
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
    apple: "/apple-touch-icon.png",
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
        <script defer src="https://stats.readcine.com/script.js" data-website-id="56c0a024-728b-4820-90da-8abdc821f822" />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeInit />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NavigationStatus />
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
