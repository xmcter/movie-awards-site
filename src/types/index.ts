/** 流媒体平台 */
export type StreamingPlatform =
  | "netflix"
  | "disney-plus"
  | "prime"
  | "hulu"
  | "max"
  | "apple-tv"
  | "iqiyi"
  | "tencent"
  | "youku"
  | "bilibili"
  | "mubi"
  | "other";

/** 上线日期状态：已公布 / 预计 / 待定 */
export type ReleaseStatus = "announced" | "estimated" | "tba";

/** 奖项结果：入围 / 获奖 */
export type AwardResult = "nominated" | "won";

/** FIAPF A 类电影节组织标识 */
export type AwardOrgId =
  | "cannes"
  | "venice"
  | "berlin"
  | "locarno"
  | "san-sebastian"
  | "shanghai"
  | "tokyo"
  | "busan"
  | "toronto"
  | "karlovy-vary"
  | "warsaw"
  | "tallinn"
  | "cairo"
  | "mar-del-plata"
  | "iffi"
  | "annecy"
  | "clermont-ferrand";

export interface StreamingRelease {
  platform: StreamingPlatform;
  /** ISO date YYYY-MM-DD，tba 时可省略 */
  date?: string;
  status: ReleaseStatus;
  region?: string;
  note?: string;
}

export interface Film {
  id: string;
  title: string;
  titleEn?: string;
  year: number;
  synopsis: string;
  directors: string[];
  cast: string[];
  genres: string[];
  runtime?: number;
  country?: string[];
  /** 海报色渐变用，如 ["#1a1a2e", "#16213e"] */
  posterColors?: [string, string];
  streaming: StreamingRelease[];
}

export interface CategoryNomination {
  categoryId: string;
  categoryName: string;
  filmId: string;
  personIds?: string[];
  personNames?: string[];
  result: AwardResult;
}

export interface AwardCeremony {
  id: string;
  orgId: AwardOrgId;
  name: string;
  nameEn?: string;
  year: number;
  date?: string;
  location?: string;
  nominations: CategoryNomination[];
}

export interface AwardOrg {
  id: AwardOrgId;
  name: string;
  nameEn: string;
  description: string;
  country: string;
  founded?: number;
  accentColor: string;
}

/** 时间线事件类型 */
export type TimelineEventType = "nomination" | "win" | "streaming";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  /** 排序用 ISO 日期；待定用空字符串 */
  date: string;
  dateLabel: string;
  filmTitle: string;
  filmTitleEn?: string;
  filmYear?: number;
  summary: string;
  detail?: string;
  /** 入围 / 获奖 / 流媒体 */
  badge: string;
  accentColor?: string;
}
