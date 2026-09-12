import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "银幕奖讯 · A类电影节·作者向时间线",
  description:
    "FIAPF A类电影节入围、获奖与作者向影讯时间线。覆盖曙纳、威尼斯、柏林等 A 类电影节，并收录诺兰、伊尼亚里图等作者导演的非竞赛影讯。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
