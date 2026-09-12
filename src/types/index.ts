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

export type ReleaseStatus = "announced" | "estimated" | "tba";
export type AwardResult = "nominated" | "won";

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
  | "clermont-ferrand"
  | "oscars"
  | "golden-globes"
  | "golden-horse"
  | "hkfa";

export interface StreamingRelease {
  platform: StreamingPlatform;
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
  poster?: string;
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
  date?: string;
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

export type AuteurNewsKind =
  | "trailer"
  | "release"
  | "box-office"
  | "promo"
  | "production";

export interface AuteurNews {
  id: string;
  filmId: string;
  date: string;
  kind: AuteurNewsKind;
  summary: string;
  detail?: string;
}

export type TimelineEventType = "nomination" | "win" | "streaming" | "auteur";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  dateLabel: string;
  filmTitle: string;
  filmTitleEn?: string;
  filmYear?: number;
  poster?: string;
  posterColors?: [string, string];
  summary: string;
  detail?: string;
  badge: string;
  accentColor?: string;
}
