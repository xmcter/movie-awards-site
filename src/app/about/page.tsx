import type { Metadata } from "next";
import Link from "next/link";

const title = "关于银幕新讯";
const description =
  "关于银幕新讯（news.readcine.com）：聚焦优质新片流媒体定档、出资源通知与微博原帖，由 ReadCine 编辑部运营。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: `${title} · 银幕新讯`,
    description,
    url: "https://news.readcine.com/about",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "银幕新讯" }],
  },
};

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-cinema-muted">
        <Link href="/" className="hover:text-cinema-gold">
          ← 时间线
        </Link>
      </p>

      <header className="rounded-2xl border border-cinema-border bg-cinema-card px-6 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cinema-gold">
          About ReadCine News
        </p>
        <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
          关于银幕新讯
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-cinema-muted sm:text-base">
          「银幕新讯」（news.readcine.com）聚焦<strong>流媒体定档</strong>与<strong>出资源通知</strong>：只告诉影迷两件事——这部新片什么时候能在流媒体看，以及什么时候已经有可下资源。
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">本站定位</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站围绕<strong>「新片流媒体定档」</strong>与<strong>「新片出资源通知」</strong>两大主轴运转，由<strong>银幕新讯（news）</strong>发布官宣流媒体定档日与资源释出通知，<strong>电影导赏（guide）</strong>提供无剧透背景、风格与看点参谋。每条消息均关联影片档案页，并可查看导赏；有可核微博原帖的通知同时提供微博入口。本站仅提供资讯，不展示资源获取或登录入口。
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">编辑标准</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            为避免信息过载与营销噪音，编辑部执行严格的“少而精”筛选准则（详见仓库{" "}
            <code className="text-xs text-cinema-gold">EDITORIAL.md</code>）：
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">每日数量上限与优先级：</span>
              每个自然日最多收录 3 条精选卡片，宁缺毋滥（无每日下限）。同一天若有多条消息，按“出资源通知 &gt; 流媒体已上线 &gt; 流媒体定档官宣”的优先级取舍。
            </li>
            <li>
              <span className="text-cinema-text">主轴 A · 新片流媒体定档：</span>
              收录官方或权威行业媒体公布的确切流媒体上线日期（<code className="text-xs">YYYY-MM-DD</code>）与平台（Netflix / Apple TV+ / Max / Prime Video / Criterion Channel / MUBI / Disney+ / 国内正版平台等），必填地区与可核信源。聚焦作者向、制作精良的新片与焦点文艺片，获奖不是必要条件。
            </li>
            <li>
              <span className="text-cinema-text">主轴 B · 新片出资源通知：</span>
              当高质量中字压制释出（WEB-DL / BDRip / 官方数字版等，国内影迷可实际获取）时，发布时间线通知并附资源形态简述；有可核微博原帖时提供微博入口（每片首次出资源记一次，重大画质升级可再记一次）。
            </li>
            <li>
              <span className="text-cinema-text">特例：</span>
              经典神作首次 4K / CC 修复上线流媒体，按主轴 A（定档/已上线）收录。
            </li>
            <li>
              <span className="text-cinema-text">不收录内容：</span>
              <strong>时间线完全不进影展/奖项/入围/提名</strong>；不收纯商业爆米花与超级英雄连载；不收纯国外线下院线点映或开画；不收口碑刷屏、公关分数微调、票房炒作；不收无确切日期的 TBA；不收无中字无法获取的资源传闻。出资源通知目前<strong>仅站内时间线</strong>。
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">流媒体与资源核实规则</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            影片档案页中，已公布确切上线日期的流媒体条目排在前面（按日期由近到远并标注平台与地区），待定的排在后面并标明“待定”。
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">流媒体字段：</span>
              只写官方已公布的确切日期（<code className="text-xs">YYYY-MM-DD</code>）和平台，未公布写“待定”；地区必须如实标注（美国区日期只写美国，不当全球）。
            </li>
            <li>
              <span className="text-cinema-text">参考来源：</span>
              Netflix / Apple TV+ / Max / Prime Video / MUBI / Criterion Channel / Disney+ 官方月单，Variety、Deadline、The Wrap 等权威行业官宣（When To Stream、JustWatch 须经官方月单或行业媒体二次核对），以及 ReadCine 电影片库实测入库记录。
            </li>
            <li>
              <span className="text-cinema-text">更新方式：</span>
              数据随仓库发布，非实时爬取；消息按内容首次发布或入库时间倒序排列，时间线不展示日期，也不按平台定档日期排序。
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">运营与站群</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站由 <span className="text-cinema-text">ReadCine 编辑部</span>{" "}
            独立维护与运营，隶属于{" "}
            <a
              href="https://readcine.com"
              className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              readcine.com
            </a>{" "}
            影迷工具与资料站群。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">资料纠错</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            尽管我们在发布前会交叉核对各方信源，仍难免偶有疏漏。若您发现片名译法、导演与主创署名、奖项归属或排映日期存在错误，欢迎随时发邮件至{" "}
            <a
              href="mailto:mloder@qq.com"
              className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              mloder@qq.com
            </a>{" "}
            指正，编辑部核实后将及时修订。
          </p>
        </div>
      </section>
    </div>
  );
}
