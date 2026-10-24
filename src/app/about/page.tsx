import type { Metadata } from "next";
import Link from "next/link";

const title = "关于银幕新讯";
const description =
  "关于银幕新讯（news.readcine.com）：聚焦作者向新片与 A 类国际电影节、奥斯卡、金球奖、金马奖、香港金像奖核心资讯的中文时间线，由 ReadCine 编辑部运营。";

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
          「银幕新讯」（news.readcine.com）是一份聚焦作者向新片动态与国际重要影展、核心电影奖项的中文时间线，旨在帮助影迷用最短时间掌握值得关注的银幕节点。
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">本站定位</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            我们按已经发生的确切日期，整理作者向新片的首映、公映、流媒体上线，以及 A
            类国际电影节、奥斯卡、金球奖、金马奖与香港金像奖的入围和获奖脉络。每条消息均关联对应的影片档案页，串联起一部作品从电影节入围、首映口碑到院线与流媒体发行的完整轨迹。
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">编辑标准</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            为避免信息过载与营销噪音，编辑部执行严格的“少而精”筛选准则：
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">每日数量上限：</span>
              每个自然日最多收录 3 条动态，宁缺毋滥。同一天若有多条消息，按“主要奖项揭晓
              &gt; 主竞赛入围与重点提名 &gt; 作者新片首映/院线公映/官宣定档流媒体 &gt;
              影评口碑首次突破 80%”的优先级取舍。
            </li>
            <li>
              <span className="text-cinema-text">收录范围：</span>
              涵盖戛纳、威尼斯、柏林、洛迦诺、圣塞巴斯蒂安、釜山、东京、卡罗维发利等 A
              类电影节主竞赛单元入围片单与主竞赛核心大奖（最佳影片、评审团大奖、最佳导演、评审团奖、最佳表演、最佳编剧等），以及奥斯卡、金球奖、金马奖、香港金像奖的主要奖项；同时跟进片单内重点作者导演的新片世界首映、正式院线上映、已官宣确切日期的流媒体上线、重大终身/荣誉奖，以及影片在主流影评聚合平台首次达到
              80% 及以上好评率（每部影片仅记录首次达标）。
            </li>
            <li>
              <span className="text-cinema-text">不收录内容：</span>
              不收商业爆米花大片与超级英雄连载；不收创投论坛与制作中项目（WIP）奖、非主竞赛单元副奖、观众奖与技术支线奖、影评人协会奖及非
              A 类小型影展；不追踪影评样本数量增加或分数微调、票房成绩、发行扩映公关、映后掌声等营销讯息；未公布确切上线日期的流媒体消息仅保留在影片档案页，不进入时间线。
            </li>
            <li>
              <span className="text-cinema-text">信息来源与撰写：</span>
              站内条目均依据各大电影节与奖项官方公报、发行方正式通告及权威行业媒体的公开报道核实，由编辑部以简明、克制的中文重新梳理撰写。
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">运营与站群</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站由 <span className="text-cinema-text">ReadCine 编辑部</span>{" "}
            独立维护与运营，隶属于{" "}
            <a
              href="https://go.readcine.com"
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
