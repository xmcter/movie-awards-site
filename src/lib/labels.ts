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

/** 从 streaming.source / sourceLabel 推导卡片上来源标签；无来源时返回 undefined（编辑种子可不显示）。 */
export function streamingSourceLabel(release: {
  source?: string;
  sourceLabel?: string;
}): string | undefined {
  const explicit = release.sourceLabel?.trim();
  if (explicit) return explicit;
  const src = release.source?.trim();
  if (!src) return undefined;
  try {
    const host = new URL(src).hostname.replace(/^www\./i, "").toLowerCase();
    if (host.includes("whentostream")) return "When To Stream";
    if (host.includes("whats-on-netflix")) return "What's on Netflix";
    if (host.includes("movieofthenight") || host.includes("streamingavailability"))
      return "片夜定档";
    if (host.includes("deadline")) return "Deadline";
    if (host.includes("variety")) return "Variety";
    if (host.includes("thewrap")) return "The Wrap";
    if (host.includes("filmaffinity")) return "FilmAffinity";
    if (host.includes("criterion")) return "Criterion";
    if (host.includes("apple.com")) return "Apple TV Press";
    return host;
  } catch {
    return undefined;
  }
}

