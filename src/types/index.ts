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

/** 奖项结果：提名 / 获奖 */
export type AwardResult = "nominated" | "won";

/** 奖项组织标识 */
export type AwardOrgId =
  | "oscars"
  | "golden-globes"
  | "cannes"
  | "venice"
  | "berlin"
  | "golden-horse"
  | "hkfa"
  | "huabiao";

export interface Person {
  id: string;
  name: string;
  nameEn?: string;
  role?: string;
}

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
  /** 相关人物，如演员、导演 */
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

export interface SearchResult {
  type: "film" | "person" | "award";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}
