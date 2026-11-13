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
  /** 资讯首次发布/入库时间；与平台上线日期 date 分离。 */
  publishedAt?: string;
  /** 源站原文发布时间（若可得）；优先于 publishedAt 展示。 */
  sourcePublishedAt?: string;
  platform: StreamingPlatform;
  date?: string;
  status: ReleaseStatus;
  region?: string;
  note?: string;
  /** 来源：平台官方月单 / When To Stream / JustWatch / 行业媒体官宣（Variety、Deadline、The Wrap 等）。编辑规则要求必填，字段可选仅为兼容旧数据。 */
  source?: string;
  /** 可选展示名；缺省时由 source URL host 推导（见 labels.streamingSourceLabel）。 */
  sourceLabel?: string;
}

export type FilmKind = "film" | "honor" | "jury";

export interface Film {
  id: string;
  title: string;
  titleEn?: string;
  year: number;
  synopsis: string;
  /** English synopsis (translated by scripts/translate-new.mjs). */
  synopsisEn?: string;
  /** 创作背景：导演路径、改编依据、展映/定档等已发生的公开信息 */
  background?: string;
  /** English background (translated by scripts/translate-new.mjs). */
  backgroundEn?: string;
  directors: string[];
  cast: string[];
  genres: string[];
  runtime?: number;
  country?: string[];
  /**
   * 采入时还没有可用中文文案。title = 缺译名；synopsis = 简介待人工翻译或补写。
   * 补进 film-copy.json 后，读取时由 applyCopy 覆盖。
   */
  copyPending?: Array<"title" | "synopsis">;
  poster?: string;
  posterColors?: [string, string];
  streaming: StreamingRelease[];
  /**
   * 豆瓣评分。构建前由 scripts/fill-douban-ratings.mjs 补在影片所属 catalog 上。
   * 没有评分就不写这个字段，页面也不显示占位。
   */
  doubanRating?: DoubanRating;
}

/** 豆瓣评分。只存分数相关字段，不混入导演、演员或简介。 */
export interface DoubanRating {
  /** 豆瓣评分（10 分制）。0 表示暂无评分，脚本不写入。 */
  score: number;
  /** 评分人数 */
  count: number;
  /** 豆瓣 subject id */
  doubanId: string;
  /** 抓取时间，ISO 8601 */
  updatedAt: string;
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
  /** 可选精确发布时间；旧稿使用 date（消息发布日）。 */
  publishedAt?: string;
  /** 源站/原文发布时间（片库 posted_at、微博发帖等）；优先于入库时间展示与排序。 */
  sourcePublishedAt?: string;
  id: string;
  filmId: string;
  date: string;
  kind: AuteurNewsKind;
  summary: string;
  /** English summary (translated by scripts/translate-new.mjs). */
  summaryEn?: string;
  detail?: string;
  /** English detail (translated by scripts/translate-new.mjs). */
  detailEn?: string;
  /** 抓取源站可读名（中文优先）。 */
  sourceLabel?: string;
  /** 源站 URL（微博原帖等）；勿放网盘。 */
  source?: string;
  /** 微博原帖；不存网盘链接或提取码。 */
  weiboUrl?: string;
  weiboLabel?: string;
}

export type TimelineEventType = "nomination" | "win" | "streaming" | "auteur";

export interface TimelineEvent {
  /** 排序只用内容发布时间，不用定档/上映时间。 */
  publishedAt?: string;
  id: string;
  type: TimelineEventType;
  date: string;
  dateLabel: string;
  filmId?: string;
  filmTitle: string;
  filmTitleEn?: string;
  filmYear?: number;
  /** 豆瓣评分。没有分就不设，时间线不占位。 */
  doubanScore?: number;
  poster?: string;
  posterColors?: [string, string];
  /** 醒目新闻标题（列表 h2） */
  headline?: string;
  summary: string;
  plot?: string;
  filmAwards?: { filmId: string; year: number; festival: string; festivalEn?: string; category: string; categoryEn?: string; result: string; source: string; icon?: string }[];
  detail?: string;
  badge: string;
  accentColor?: string;
  awards?: string[];
  directors?: string[];
  filmKind?: FilmKind;
  /** 抓取源站可读名（中文优先） */
  sourceLabel?: string;
  sourceUrl?: string;
  /** 源站/原文发布时间 ISO；列表展示用，不是定档日。 */
  sourcePublishedAt?: string;
  /** 列表短标签，如「原文 11月6日 18:40」或「收录 11月5日」 */
  sourcePublishedLabel?: string;
  weiboUrl?: string;
  weiboLabel?: string;
}
