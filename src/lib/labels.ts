import type { AwardResult, ReleaseStatus, StreamingPlatform } from "@/types";

export const PLATFORM_LABELS: Record<StreamingPlatform, string> = {
  netflix: "Netflix",
  "disney-plus": "Disney+",
  prime: "Prime Video",
  hulu: "Hulu",
  max: "Max",
  "apple-tv": "Apple TV+",
  iqiyi: "爱奇艺",
  tencent: "腾讯视频",
  youku: "优酷",
  bilibili: "哔哩哔哩",
  mubi: "MUBI",
  other: "其他平台",
};

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  announced: "",  // 有日期直接写日期，不写「已公布」
  estimated: "预计",
  tba: "待定",
};

/** 影片类型展示用中文；未知英文保留原样，不臆造。 */
export const GENRE_LABELS: Record<string, string> = {
  Drama: "剧情",
  drama: "剧情",
  Crime: "犯罪",
  Fantasy: "奇幻",
  History: "历史",
  "Science Fiction": "科幻",
  "Sci-Fi": "科幻",
  Thriller: "惊悚",
  Comedy: "喜剧",
  Romance: "爱情",
  Action: "动作",
  Adventure: "冒险",
  Horror: "恐怖",
  Documentary: "纪录片",
  Animation: "动画",
  Family: "家庭",
  Mystery: "悬疑",
  War: "战争",
  Western: "西部",
  Music: "音乐",
  Biography: "传记",
  Sport: "运动",
};

export function genreLabel(g: string): string {
  const t = (g || "").trim();
  if (!t) return "";
  if (GENRE_LABELS[t]) return GENRE_LABELS[t];
  // 已是中文
  if (/[\u4e00-\u9fff]/.test(t)) return t;
  return GENRE_LABELS[t] || t;
}

export function genreLabels(genres: string[] | undefined): string[] {
  return (genres || []).map(genreLabel).filter(Boolean);
}


export const AWARD_RESULT_LABELS: Record<AwardResult, string> = {
  nominated: "入围",
  won: "获奖",
};

export function formatDate(date?: string): string {
  if (!date) return "待定";
  const [y, m, d] = date.split("-");
  if (!y || !m) return date;
  return d ? `${y}年${Number(m)}月${Number(d)}日` : `${y}年${Number(m)}月`;
}

export function formatYearMonth(date?: string): string {
  if (!date) return "待定";
  const [y, m] = date.split("-");
  return `${y}年${Number(m)}月`;
}

/** 中文优先的来源可读名；兼容旧英文标签。 */
const SOURCE_LABEL_ZH: Record<string, string> = {
  "What's on Netflix": "Netflix上新日历",
  "Whats on Netflix": "Netflix上新日历",
  "When To Stream": "定档追踪",
  "Movie of the Night": "片夜定档",
  "The Wrap": "The Wrap",
};

export function normalizeSourceLabel(label?: string): string | undefined {
  const raw = label?.trim();
  if (!raw) return undefined;
  return SOURCE_LABEL_ZH[raw] || raw;
}

/** 从 streaming.source / sourceLabel 推导卡片上来源标签；无来源时返回 undefined（编辑种子可不显示）。 */
export function streamingSourceLabel(release: {
  source?: string;
  sourceLabel?: string;
}): string | undefined {
  const explicit = normalizeSourceLabel(release.sourceLabel);
  if (explicit) return explicit;
  const src = release.source?.trim();
  if (!src) return undefined;
  try {
    const host = new URL(src).hostname.replace(/^www\./i, "").toLowerCase();
    if (host.includes("whentostream")) return "定档追踪";
    if (host.includes("whats-on-netflix")) return "Netflix上新日历";
    if (host.includes("movieofthenight") || host.includes("streamingavailability"))
      return "片夜定档";
    if (host.includes("weibo.cn") || host.includes("weibo.com")) return "微博";
    if (host.includes("deadline")) return "Deadline";
    if (host.includes("variety")) return "Variety";
    if (host.includes("thewrap")) return "The Wrap";
    if (host.includes("filmaffinity")) return "FilmAffinity";
    if (host.includes("criterion")) return "Criterion";
    if (host.includes("apple.com")) return "Apple TV 新闻";
    if (host.includes("hollywoodreporter") || host.includes("thr.com")) return "好莱坞报道";
    return host;
  } catch {
    return undefined;
  }
}

/** 列表展示用：原文/收录短日期（不用定档日）。 */
export function formatSourcePublishedLabel(
  iso?: string,
  opts?: { isOriginal?: boolean },
): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return undefined;
  const [, , mo, d, hh, mm] = m;
  const day = `${Number(mo)}月${Number(d)}日`;
  const prefix = opts?.isOriginal === false ? "收录" : "原文";
  if (hh && mm && !(hh === "00" && mm === "00")) {
    return `${prefix} ${day} ${hh}:${mm}`;
  }
  return `${prefix} ${day}`;
}

