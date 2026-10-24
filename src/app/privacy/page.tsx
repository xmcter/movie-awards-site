import type { Metadata } from "next";
import Link from "next/link";

const title = "隐私政策";
const description =
  "银幕新讯（news.readcine.com）隐私政策：说明静态托管架构、浏览器本地存储键值、第三方服务（GitHub Pages、Google Fonts）与 Google AdSense 广告 Cookie 政策。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: `${title} · 银幕新讯`,
    description,
    url: "https://news.readcine.com/privacy",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "银幕新讯" }],
  },
};

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-cinema-muted">
        <Link href="/" className="hover:text-cinema-gold">
          ← 时间线
        </Link>
      </p>

      <header className="rounded-2xl border border-cinema-border bg-cinema-card px-6 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cinema-gold">
          Privacy Policy
        </p>
        <h1 className="mt-2 font-display text-2xl text-cinema-text sm:text-3xl">
          隐私政策
        </h1>
        <p className="mt-2 text-xs text-cinema-muted">生效日期：2026-10-24</p>
        <p className="mt-4 text-sm leading-relaxed text-cinema-muted sm:text-base">
          本隐私政策说明「银幕新讯」（
          <a
            href="https://news.readcine.com"
            className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
          >
            news.readcine.com
          </a>
          ，以下简称“本站”）在您浏览与使用过程中如何处理信息。我们坚持最小化原则，不设账号体系，也不在自有服务器存储个人身份信息。
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border border-cinema-border bg-cinema-card p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">1. 概述</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站是由 ReadCine 编辑部运营的纯静态资讯网站（通过 GitHub Pages
            托管），不提供用户注册、登录、评论或表单提交功能，不主动收集您的姓名、电子邮箱、电话号码等个人身份信息。仅当您主动通过电子邮件联系编辑部时，我们才会收到您邮件中提供的联系信息并仅用于回复沟通。
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            2. 本地存储（Cookie 与 localStorage / sessionStorage）
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            为记住您的阅读进度与界面偏好，本站本身不设置自有 Cookie，仅在您的浏览器本地使用{" "}
            <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
              localStorage
            </code>{" "}
            与{" "}
            <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
              sessionStorage
            </code>{" "}
            保存以下键值。这些数据完全保存在您的设备浏览器内，绝不会上传至本站服务器：
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_last_seen_v1
              </code>
              （localStorage）：记录上次浏览时可见的最新时间线卡片日期与条目 ID
              集合，用于在后续访问时标出「上次看到这里」及「新」标记。
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_last_seen_visit_v1
              </code>
              （sessionStorage）：记录当次访问会话（30 分钟窗口内）的基准位置，以便从详情页返回列表时保持当次「新」标记稳定。
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news-readcine:clicked
              </code>{" "}
              /{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news-readcine:lastId
              </code>{" "}
              /{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news-readcine:listScroll
              </code>
              （localStorage）：分别保存已点击阅读过的条目 ID 列表、最近一次点击的条目 ID
              以及时间线列表滚动位置，用于恢复阅读状态。
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_dismiss_marks_v1
              </code>
              （localStorage）：保存您手动点击「不感兴趣 / 隐藏」的条目及相似屏蔽规则记录。
            </li>
            <li>
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                news_dedup_by_film_v1
              </code>
              （localStorage）：保存时间线「同片合并」开关状态。
            </li>
            <li>
              主题偏好（日间 / 夜间模式）：由前端组件{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                ThemeInit
              </code>{" "}
              根据设备本地时间（06:00–18:00 为日间）在{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                &lt;html&gt;
              </code>{" "}
              根元素上自动切换{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                theme-day
              </code>{" "}
              与{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                theme-night
              </code>{" "}
              类名，不写入任何 localStorage 键值。
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            您随时可以通过浏览器的「清除浏览数据 / 清除站点数据」功能删除上述全部本地存储记录。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">3. 统计分析</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站目前未接入任何第三方流量统计或行为分析工具。若未来接入统计服务，我们将同步更新本隐私政策并说明相应的数据处理方式。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">4. 第三方服务</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              <span className="text-cinema-text">GitHub Pages 托管：</span>
              本站静态文件托管于 GitHub Pages。当您访问本站时，GitHub
              服务器日志可能会自动记录您的 IP 地址、浏览器类型、访问时间与请求页面等基础网络信息，相关处理受{" "}
              <a
                href="https://docs.github.com/zh/site-policy/privacy-policies/github-general-privacy-statement"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                GitHub 隐私声明
              </a>{" "}
              约束。
            </li>
            <li>
              <span className="text-cinema-text">Google Fonts：</span>
              本站样式引用了 Google Fonts（Noto Sans SC / Noto Serif SC）。浏览器加载字体资源时会向{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                fonts.googleapis.com
              </code>{" "}
              与{" "}
              <code className="rounded bg-cinema-elevated px-1.5 py-0.5 text-xs text-cinema-text">
                fonts.gstatic.com
              </code>{" "}
              发起请求，相关请求受 Google 隐私政策约束。
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg text-cinema-text">
            5. 广告与 Google AdSense
          </h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站可能使用 Google AdSense 展示广告以维持站点日常运营：
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cinema-muted">
            <li>
              第三方供应商（包括 Google）会使用 Cookie，根据用户此前访问本站或互联网上其他网站的情况向用户投放广告。
            </li>
            <li>
              Google 使用广告 Cookie（包括 DoubleClick / DART Cookie），使其及其合作伙伴能够基于用户访问本站和/或互联网上其他网站的情况向用户展示广告。
            </li>
            <li>
              用户可随时访问{" "}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                Google 广告设置（adssettings.google.com）
              </a>{" "}
              或{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                www.google.com/settings/ads
              </a>{" "}
              停用个性化广告；也可访问{" "}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                www.aboutads.info/choices/
              </a>{" "}
              停用第三方供应商用于个性化广告的 Cookie；欧盟及欧洲经济区用户可参考{" "}
              <a
                href="https://www.youronlinechoices.eu/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                www.youronlinechoices.eu
              </a>
              。
            </li>
            <li>
              关于 Google 如何在广告服务及合作伙伴网站中使用数据的更多详情，请参阅{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                Google 广告技术政策（policies.google.com/technologies/ads）
              </a>{" "}
              以及{" "}
              <a
                href="https://policies.google.com/technologies/partner-sites"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
              >
                Google 如何处理使用其服务的网站或应用的信息（policies.google.com/technologies/partner-sites）
              </a>
              。
            </li>
            <li>
              除 Google AdSense 外，未来本站还可能接入其他合规第三方广告网络，届时将在本页更新列出。
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">6. 数据保留</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站自身不在服务器端保存任何访问者浏览数据；浏览器本地存储（localStorage /
            sessionStorage）保留在您的设备中，直至您主动清除浏览器站点数据；第三方基础设施与服务商（如
            GitHub、Google）按其各自公布的隐私政策与保留期限处理相关日志或 Cookie。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">7. 儿童隐私</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站内容面向一般电影爱好者与行业读者，不面向 13 岁以下儿童，也不会故意收集 13
            岁以下儿童的任何个人信息。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">8. 外部链接</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            本站可能包含指向 readcine.com 站群其他子站或第三方外部网站的链接。外部网站有其独立的隐私政策，不受本隐私政策约束，建议您在访问时查阅相应站点的隐私声明。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">9. 政策变更</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            我们可能根据站点功能或合规要求适时修订本隐私政策。政策更新后将直接在本页面发布，并同步修改页面顶部的生效日期。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg text-cinema-text">10. 联系我们</h2>
          <p className="text-sm leading-relaxed text-cinema-muted sm:text-base">
            如您对本隐私政策有任何疑问或建议，请发送邮件至：
            <a
              href="mailto:mloder@qq.com"
              className="ml-1 underline decoration-cinema-border underline-offset-2 hover:text-cinema-gold"
            >
              mloder@qq.com
            </a>
            。
          </p>
        </div>
      </section>
    </div>
  );
}
