import type { Metadata } from "next";
import Link from "next/link";

const title = "联系我们";
const description =
  "联系银幕新讯（ReadCine 编辑部）：提供资料纠错、新片与节展线索补充、商务及站点合作联系方式。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: `${title} · 银幕新讯`,
    description,
    url: "https://news.readcine.com/contact",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "银幕新讯" }],
  },
};

export default function ContactPage() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-cinema-muted">
        <Link href="/" className="hover:text-cinema-gold">
          ← 时间线
        </Link>
      </p>

      <header className="rounded-2xl border border-cinema-border bg-cinema-card px-6 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cinema-gold">
          Contact Us
        </p>
        <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
          联系我们
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-cinema-muted sm:text-base">
          「银幕新讯」由 ReadCine 编辑部负责日常内容维护与站点运营。欢迎通过电子邮件与我们取得联系。
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">电子邮箱</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            联系邮箱：
            <a
              href="mailto:mloder@qq.com"
              className="font-medium text-cinema-gold underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold-light"
            >
              mloder@qq.com
            </a>
          </p>
          <p className="text-xs text-cinema-muted/80">
            运营团队：ReadCine 编辑部（我们会在数个工作日内尽量查阅并回复每一封来信）。
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">来信事项说明</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">资料纠错：</span>
              如发现站内影片译名、主创名单、电影节入围与获奖结果或定档日期有误，请在邮件中附上对应页面链接与参考信源，我们将第一时间核对更正。
            </li>
            <li>
              <span className="text-cinema-text">新讯线索：</span>
              欢迎提供符合本站编辑标准的作者新片定档、A
              类电影节主竞赛动态或官方流媒体上线消息（请附官方公报或权威行业媒体报道链接）。
            </li>
            <li>
              <span className="text-cinema-text">合作与交流：</span>
              站点友链、内容转载授权、广告及商务合作咨询，请在邮件标题中注明合作意向。
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
