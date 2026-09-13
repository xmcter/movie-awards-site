import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const siteUrl = "https://news.readcine.com";
const title = "银幕奖讯 · 时间线";
const description =
  "A类电影节、奥斯卡、金球、金马、金像与作者向影讯时间线。主跟暨纳、威尼斯、柏林入围与获奖，兼收录流媒体定档。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · 银幕奖讯",
  },
  description,
  keywords: [
    "电影节",
    "暨纳",
    "威尼斯",
    "柏林",
    "奥斯卡",
    "金球",
    "金马",
    "金像",
    "获奖",
    "入围",
    "流媒体",
  ],
  authors: [{ name: "银幕奖讯" }],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: siteUrl,
    siteName: "银幕奖讯",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "银幕奖讯",
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
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
