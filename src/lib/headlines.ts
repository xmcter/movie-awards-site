import type {
  AwardCeremony,
  AwardOrg,
  CategoryNomination,
  Film,
  FilmKind,
} from "@/types";

/** 片名词：《片名》 */
export function filmQuote(title: string): string {
  const t = title.trim();
  if (!t) return "《未命名》";
  if (t.startsWith("《") && t.endsWith("》")) return t;
  return `《${t}》`;
}

/** 人名短称：取中文全名或英文姓氏感短写（不过度裁切） */
export function personShort(name?: string): string {
  if (!name) return "";
  const n = name.trim();
  if (!n) return "";
  // 西方名：若含 · 取最后一段常见姓；中文保持
  if (n.includes("·")) {
    const parts = n.split("·").filter(Boolean);
    if (parts.length >= 2 && parts[parts.length - 1]!.length <= 4) {
      return parts[parts.length - 1]!;
    }
  }
  return n;
}

function directorLead(film: Film): string {
  return film.directors[0] || film.cast[0] || "";
}

function ceremonyShort(name: string): string {
  return name
    .replace(/国际电影节$/, "")
    .replace(/电影节$/, "")
    .replace(/奖$/, "");
}

/** 是否「最高荣誉 / 主奖」类 */
function isTopPrize(categoryName: string): boolean {
  // 排除地平线/单元等分部大奖，避免「问鼎地平线最佳影片」
  if (/地平线|单元|短片|纪录片|沉浸|观众/.test(categoryName)) return false;
  return /^(金棕榈|金狮奖?|金熊奖?|金豹奖?|金贝壳|水晶球奖?|东京大奖|釜山奖最佳影片|金爵奖最佳影片|最佳影片|最佳电影|剧情类最佳影片|音乐\/喜剧类最佳影片|最佳剧情片)/.test(
    categoryName
  ) || /金棕榈|金狮奖|金熊奖|金豹奖|金贝壳|水晶球/.test(categoryName);
}

function isActingPrize(categoryName: string): boolean {
  return /男主|女主|男配|女配|最佳主演|最佳表演|沃尔皮|马斯特罗亚尼|演员/.test(
    categoryName
  );
}

function isDirectingPrize(categoryName: string): boolean {
  return /最佳导演|导演银狮|导演（银熊）|最佳导演（银熊）|最佳导演银狮/.test(
    categoryName
  );
}

function isOpening(categoryName: string): boolean {
  return /开幕/.test(categoryName);
}

function isHonor(categoryName: string): boolean {
  return /荣誉|终身|致敬/.test(categoryName);
}

function isJury(categoryName: string): boolean {
  return /评委主席|评审团主席|评委会主席/.test(categoryName);
}

/** 硬编码少数更醒目的标题（有公开叙事支撑） */
const HEADLINE_OVERRIDES: Record<string, string> = {
  // filmId|orgId|year|win|topCategory fragment
  "fjord|cannes|2026|win": "蒙吉二封金棕榈：《峡湾》问鼎第79届戛纳",
  "ink|venice|2026|nom": "第83届威尼斯开幕：丹尼·博伊尔《墨》领衔主竞赛",
  "yellow-letters|berlin|2026|win": "恰塔克《告知信》夺第76届柏林金熊",
  "woman-unknown|venice|2026|win": "梅·埃尔-图希《女人，未知》问鼎第83届威尼斯金狮",
  "possible-love|venice|2026|win": "李沧东《可能的爱情》获第83届威尼斯评审团大奖",
  "one-battle|oscars|2026|win": "PTA《一战再战》问鼎第98届奥斯卡最佳影片",
  "hamnet|golden-globes|2026|win": "赵婷《哈姆奈特》获第83届金球剧情类最佳影片",
  "a-foggy-tale|golden-horse|2025|win": "陈玉勋《大濱》问鼎第62届金马最佳剧情片",
  "los-domingos|san-sebastian|2025|win": "《礼拜天》问鼎第73届圣塞金贝壳",
  "two-seasons-two-strangers|locarno|2025|win": "三宅唱《旅途中的日子》夺第78届洛迦诺金豹",
  "palestine-36|tokyo|2025|win": "《巴勒斯坦36号》获第38届东京大奖",
  "you-dont-belong-here|locarno|2026|win": "塞尔班《你不属于这里》夺第79届洛迦诺金豹",
  "fruit-gathering|karlovy-vary|2026|win": "昂漂《采果》问鼎第60届卡罗维发利水晶球",
  "atlantic|shanghai|2026|win": "钟凯峰《大西洋》获第28届上海金爵奖最佳影片",
};

function overrideKey(
  filmId: string,
  orgId: string,
  year: number,
  isWin: boolean
): string {
  return `${filmId}|${orgId}|${year}|${isWin ? "win" : "nom"}`;
}

export function buildAwardHeadline(opts: {
  ceremony: AwardCeremony;
  org?: AwardOrg;
  film: Film;
  noms: CategoryNomination[];
  kind: FilmKind;
}): string {
  const { ceremony, org, film, noms, kind } = opts;
  const wins = noms.filter((n) => n.result === "won");
  const isWin = wins.length > 0;
  const ordered = isWin ? wins : noms;
  const primary = ordered[0]!;
  const cat = primary.categoryName;
  const person = primary.personNames?.[0];
  const dir = directorLead(film);
  const title = filmQuote(film.title);
  const fest = ceremony.name;

  const ov = HEADLINE_OVERRIDES[overrideKey(film.id, ceremony.orgId, ceremony.year, isWin)];
  if (ov) return ov;

  if (kind === "honor" || isHonor(cat)) {
    const who = person || film.title;
    return `${who}获${fest}${cat.replace(/^荣誉/, "荣誉")}`;
  }
  if (kind === "jury" || isJury(cat)) {
    const who = person || film.title;
    return `${who}出任${fest}${cat}`;
  }

  // 日程 / 报名类 meta
  if (/日程公布|报名开启|长片报名/.test(cat)) {
    return `${fest}：${cat}`;
  }

  if (isOpening(cat)) {
    const who = dir ? `${dir}` : "";
    return `${fest}开幕：${who}${title}领衔主竞赛`.replace("：领衔", "：");
  }

  if (isWin) {
    if (person && isActingPrize(cat)) {
      return `${person}凭${title}获${fest}${cat}`;
    }
    if (isDirectingPrize(cat)) {
      const who = person || dir;
      return who
        ? `${who}凭${title}获${fest}${cat}`
        : `${title}获${fest}${cat}`;
    }
    if (isTopPrize(cat)) {
      const who = personShort(dir) || dir;
      if (who) {
        return `${who}${title}问鼎${fest}${/奖|棕榈|狮|熊|豹|贝壳|球/.test(cat) && !fest.includes(cat) ? cat : ""}`.replace(
          /问鼎(.+)\1$/,
          "问鼎$1"
        );
      }
      return `${title}问鼎${fest}${cat}`;
    }
    // 其它奖项
    if (person) {
      return `${title}获${fest}${cat} · ${person}`;
    }
    if (dir) {
      return `${dir}${title}获${fest}${cat}`;
    }
    return `${title}获${fest}${cat}`;
  }

  // 入围 / 提名
  if (/主竞赛/.test(cat)) {
    return dir
      ? `${dir}${title}入围${fest}主竞赛`
      : `${title}入围${fest}主竞赛`;
  }
  if (person && isActingPrize(cat)) {
    return `${person}凭${title}获${fest}${cat}提名`;
  }
  return dir
    ? `${dir}${title}入围${fest}${cat}`
    : `${title}入围${fest}${cat}`;
}

export function buildAwardBody(opts: {
  ceremony: AwardCeremony;
  org?: AwardOrg;
  film: Film;
  noms: CategoryNomination[];
  awards: string[];
}): string {
  const { ceremony, org, film, awards } = opts;
  const dir = film.directors.length ? `导演 ${film.directors.join("、")}` : "";
  const awardPart =
    awards.length === 1
      ? awards[0]
      : awards.slice(0, 3).join("；") + (awards.length > 3 ? "…" : "");
  const scope = org
    ? org.name
    : ceremony.name;
  const loc = ceremony.location ? ` · ${ceremony.location}` : "";
  const bits = [
    `${ceremony.name} · ${awardPart}`,
    dir || undefined,
    `${scope}${loc}`,
  ].filter(Boolean);
  // 1–2 句可读摘要
  return bits.slice(0, 2).join("。") + (bits[2] ? `（${bits[2]}）` : "");
}

export function buildStreamingHeadline(opts: {
  film: Film;
  platform: string;
  statusLabel: string;
  datePart: string;
  region?: string;
}): string {
  const { film, platform, statusLabel, datePart, region } = opts;
  const title = filmQuote(film.title);
  const reg = region ? ` · ${region}` : "";
  if (statusLabel === "待定") {
    return `${title}${platform}窗口待定${reg}`;
  }
  return `${title}${platform}${statusLabel}${datePart}${reg}`;
}

export function buildStreamingBody(opts: {
  film: Film;
  platform: string;
  statusLabel: string;
  datePart: string;
  region?: string;
  note?: string;
}): string {
  const { film, note } = opts;
  // 副标题不再重复标题里已有的 平台/状态/日期/地区；只保留增量信息。
  const bits: string[] = [];
  if (note) {
    const cleaned = note.replace(/^[（(]\s*/, "").replace(/\s*[）)]$/, "").trim();
    if (cleaned) bits.push(cleaned);
  }
  // 导演信息不在流媒体标题里时，可作一句补充；已有 note 则不必硬凑。
  if (!bits.length && film.directors[0]) {
    bits.push(`${film.directors[0]}执导作品`);
  }
  return bits.join("。");
}

/**
 * 去掉副标题里已在主标题出现的片段，避免「标题 + 副标题列表」信息重复。
 * - 短副标题 / 「A · B · C」列表：按片去重
 * - 长正文：仅当与标题几乎同文时整段丢弃；不因正文里提到片名就清空
 */
export function dedupeSubtitleAgainstTitle(title: string, subtitle: string): string {
  const t = (title || "").trim();
  const s = (subtitle || "").trim();
  if (!s) return "";
  if (!t) return s;

  const norm = (v: string) =>
    v
      .toLowerCase()
      .replace(/[\s·•|/／、，,。；;:：\-—_（）()《》【】\[\]「」『』]/g, "");

  const nt = norm(t);
  const ns = norm(s);
  if (!ns) return "";
  if (nt === ns) return "";
  // 副标题被标题完全覆盖（副标题更短或等长）→ 丢弃
  if (ns.length <= nt.length + 4 && nt.includes(ns)) return "";
  // 副标题只是标题加极少字符 → 丢弃
  if (nt.length >= 8 && ns.startsWith(nt) && ns.length - nt.length <= 6) return "";

  // 「A · B · C」型短列表：去掉已在标题出现的片语
  const looksLikeList =
    (s.includes("·") || s.includes("|")) && s.length <= 160 && (s.match(/[·|｜]/g) || []).length >= 1;
  if (looksLikeList) {
    const parts = s
      .split(/\s*[·|｜]\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    const kept = parts.filter((p) => {
      const np = norm(p);
      if (!np) return false;
      return !nt.includes(np);
    });
    if (kept.length === 0) return "";
    if (kept.length === parts.length) return s;
    return kept.join(" · ");
  }

  return s;
}

/** 把作者向短讯 summary 收成更醒目的标题；已够新闻感则原样 */
export function polishAuteurHeadline(summary: string, film: Film): string {
  const s = summary.trim();
  if (!s) return filmQuote(film.title);
  // 已是「…·…《…》」或含问鼎/开幕/上映等动词，直接用
  if (/《.+》/.test(s) || /开幕|问鼎|上映|获|夺|入围|定档|确认|领衔/.test(s)) {
    return s.length > 48 ? s.slice(0, 46) + "…" : s;
  }
  // critic 评分类
  const rt = s.match(/critic\s+(\d+%)\s*·\s*(.+)/i);
  if (rt) {
    return `${rt[2]}${filmQuote(film.title)}口碑 ${rt[1]}`;
  }
  return `${s} · ${filmQuote(film.title)}`;
}
