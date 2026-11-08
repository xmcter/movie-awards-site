import type { Metadata } from "next";
import Link from "next/link";

const title = "不只看分数：2026 年 10 月这三部高口碑作者片，为什么可以放在一起读";
const description =
  "本站原创：同样是 2026 年 10 月前后进入口碑视野的作者片，它们的“高分”来自不同的阶段——奖后样本扩大、主竞赛后累积、已经进入院线。分数要配阶段读。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/insight/not-only-scores",
  },
  openGraph: {
    title: `${title} · 银幕新讯`,
    description,
    url: "https://news.readcine.com/insight/not-only-scores",
    type: "article",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "银幕新讯" }],
  },
};

export default function InsightNotOnlyScoresPage() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-cinema-muted">
        <Link href="/" className="hover:text-cinema-gold">
          ← 时间线
        </Link>
      </p>

      <header className="rounded-2xl border border-cinema-border bg-cinema-card px-6 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cinema-gold">
          本站原创 · 2026-11-07
        </p>
        <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
          不只看分数：2026 年 10 月这三部高口碑作者片，为什么可以放在一起读
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-cinema-muted sm:text-base">
          本站平时按时间线发奖讯和口碑，分数本身只是入口。这篇想补一个本站自己的判断：同样是
          2026 年 10 月前后进入口碑视野的作者片，它们的“高分”来自不同的阶段——有的刚在电影节拿奖后样本扩大，有的在主竞赛后口碑累积，有的已经进入院线。放在一起读，能看出选片时不该只比分数，而要看这部片处在哪个阶段、适合什么样的观众。
        </p>
        <p className="mt-4 text-sm leading-relaxed text-cinema-muted sm:text-base">
          本篇不转载任何一家媒体的全文，不提供下载或播放链接。以下分数均为新闻发布时引用的
          Rotten Tomatoes / Metacritic 汇总数字，会随样本扩大而变化，最新数字以官方页面为准。
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">本站的选片口径</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站只跟作者向新片和 FIAPF A
            类电影节、奥斯卡、金球、金马、金像这类奖讯，不收院线爆米花与超级英雄连载。这个口径本身就是筛选：进时间线的不是“最近最热”，而是“在作者电影的评价体系里有位置”。下面三部片都符合这个口径，但位置不同。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">
            1. 《温柔的关怀》：奖后样本扩大，仍保持满分的那种
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            迈克·利执导。新闻要点（截至 2026-10-23 的汇总）：Tomatometer 约 100%，样本约
            41–45 条影评，均分约 8.5/10；Metacritic 85 分（13
            评）。圣塞巴斯蒂安第 74 届金贝壳、最佳编剧与主演奖之后，样本扩大仍保持完美口碑；美国定档
            12 月有限上映，英国定档 2027 年 2 月。
          </p>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站判断：这不是“开局高分”，而是“奖后经得起扩大样本”的高分。对观众的意义是：可以先看导演以往作品对家庭与日常关系的处理方式，再看这部在同样题材上是否换了角度；不要只因为
            100% 就预期它是一部爽快的剧情片。
          </p>
          <p className="text-xs leading-relaxed text-cinema-muted">
            来源：Wikipedia / Rotten Tomatoes / Metacritic 汇总，2026-10-23 新闻（
            <Link
              href="/film/tender-loving-care"
              className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              影片档
            </Link>
            ）。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">
            2. 《纸老虎》：主竞赛后累积到 Certified Fresh 的那种
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            詹姆斯·格雷执导。新闻要点（截至 2026-10-23 的汇总）：Tomatometer 约 86%，样本
            80 条影评，均分约 7.0/10；Metacritic 79 分。戛纳主竞赛之后，影评累积跨过认证门槛；美国
            11 月先有限上映、再全国扩映。
          </p>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站判断：这部的高分结构和上一部相反——样本更大、均分更克制，说明它更可能是一部“评价分化但整体正面”的作者片。看之前值得先问：你是否接受格雷那种偏沉稳、偏人物而非情节驱动的叙事；如果期待强情节反转，这部可能不合口味。
          </p>
          <p className="text-xs leading-relaxed text-cinema-muted">
            来源：Rotten Tomatoes 官宣 / Wikipedia 汇总，2026-10-23 新闻（
            <Link
              href="/film/paper-tiger"
              className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              影片档
            </Link>
            ）。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">
            3. 《米诺陶》：已经进入院线、分数仍在高位的那种
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            安德烈·萨金塞夫执导。新闻要点（截至 2026-10-14 的汇总）：Tomatometer 约
            98%，样本 47 条影评，均分约 8.6/10。戛纳评审团大奖作品；法国 10 月 14
            日院线上映。
          </p>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站判断：这部已经从“电影节新闻”走到了“可以实际走进影院”的阶段，分数的参考价值更接近观影决策，而不是节展预测。看之前值得注意的是萨金塞夫一贯的冷峻风格：高分不等于轻松，观影体验更可能偏压抑、偏凝视。
          </p>
          <p className="text-xs leading-relaxed text-cinema-muted">
            来源：Rotten Tomatoes 汇总，2026-10-14 新闻（
            <Link
              href="/film/minotaur"
              className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              影片档
            </Link>
            ）。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">三部放在一起，读出什么</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              分数要配阶段读：奖后扩大样本、主竞赛后累积、院线阶段，三种高分的可信度和用法不一样。
            </li>
            <li>
              导演坐标比单片分数更重要：三位导演各自的作者轨迹，决定了这部片“好”在什么地方。
            </li>
            <li>
              档期要配地区读：同一部片在美、英、法的上映时间并不相同，新闻里的档期只代表当时公布的地区安排，购票前请以当地院线为准。
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">结尾</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站以后会定期做这类“不只发新闻，也给判断”的盘点：不重复时间线已经写过的事实，而是把同一时期的几条新闻按阶段、按导演、按观影预期重新组织。如果你对这个方向有意见（比如更想看单片深读、还是更想看电影节全景），可以在联系页告诉我们。
          </p>
        </div>
      </section>
    </div>
  );
}
