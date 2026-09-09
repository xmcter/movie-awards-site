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
  announced: "已公布",
  estimated: "预计",
  tba: "待定",
};

export const AWARD_RESULT_LABELS: Record<AwardResult, string> = {
  nominated: "提名",
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
