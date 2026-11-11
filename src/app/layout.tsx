import NavigationStatus from "@/components/NavigationStatus";
import LangSync from "@/components/LangSync";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ThemeInit from "@/components/ThemeInit";
import "./globals.css";

const siteUrl = "https://news.readcine.com";
const title = "电影资讯";
const description =
  "只做两件事：作者向与高口碑新片的流媒体定档时间，以及新片发行动态。今晚看什么，不收院线爆米花。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s",
  },
  description,
  keywords: [
    "流媒体定档",
    "新片发行动态",
    "新片上线",
    "新片资讯",
    "流媒体首播",
    "正版流媒体",
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
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "电影资讯",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function load(src,attrs){var s=document.createElement('script');s.src=src;s.defer=true;if(attrs){for(var k in attrs)s.setAttribute(k,attrs[k]);}(document.body||document.head).appendChild(s);}function go(){load('https://stats.readcine.com/script.js',{'data-website-id':'56c0a024-728b-4820-90da-8abdc821f822'});load('https://static.cloudflareinsights.com/beacon.min.js',{'data-cf-beacon':'{"token": "14344261ed76415c8ed6b3d387441550"}'});}if('requestIdleCallback' in window)requestIdleCallback(go,{timeout:4000});else window.addEventListener('load',function(){setTimeout(go,2000);});if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}})();`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <LangSync />
        <ThemeInit />
        <NavigationStatus />
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <Footer />

      </body>
    </html>
  );
}
