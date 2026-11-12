/** English locale support for the news site (news.readcine.com).
 * Chinese is the default; English lives under /en/. Nothing here changes
 * Chinese rendering — all helpers are additive and only used by /en/ routes.
 */
import type { Film } from "@/types";

export type Locale = "zh" | "en";

export const EN_PREFIX = "/en";

export function isEnPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname === "/en" || pathname?.startsWith("/en/"));
}

/** Map a Chinese path to its English counterpart (and back). */
export function toEnPath(pathname: string): string {
  if (pathname === "/") return "/en";
  if (pathname.startsWith("/en")) return pathname;
  return `/en${pathname}`;
}

export function toZhPath(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}

/** hreflang alternates for a page that exists in both languages. */
export function bilingualAlternates(path: string): {
  canonical: string;
  languages: { zh: string; en: string };
} {
  const enPath = path === "/" ? "/en" : `/en${path}`;
  return {
    canonical: path,
    languages: { zh: path, en: enPath },
  };
}

export function bilingualAlternatesEn(path: string): {
  canonical: string;
  languages: { zh: string; en: string };
} {
  const zhPath = path === "/en" ? "/" : path.slice(3);
  const enPath = path;
  return {
    canonical: enPath,
    languages: { zh: zhPath, en: enPath },
  };
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-11-21" -> "Nov 21" (current year) or "Nov 21, 2025" (other years). */
export function formatDateEn(date?: string, now = new Date()): string {
  if (!date) return "TBA";
  const [y, m, d] = date.split("-");
  if (!y || !m) return date;
  const year = Number(y);
  const thisYear = Number(
    new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric" }).format(now),
  );
  const md = d ? `${MONTHS_EN[Number(m) - 1]} ${Number(d)}` : `${MONTHS_EN[Number(m) - 1]}`;
  return year === thisYear ? md : `${md}, ${y}`;
}

/** "Nov 6, 2026 18:40" style source-published label. */
export function formatSourcePublishedLabelEn(
  iso?: string,
  opts?: { isOriginal?: boolean; now?: Date },
): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return undefined;
  let [, y, mo, d, hh, mm] = m;
  if (/[T ].*(?:Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
    const dt = new Date(iso);
    if (!Number.isNaN(dt.getTime())) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(dt);
      const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
      y = get("year"); mo = get("month"); d = get("day"); hh = get("hour"); mm = get("minute");
    }
  }
  const now = opts?.now || new Date();
  const thisYear = Number(
    new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric" }).format(now),
  );
  const day = Number(y) === thisYear
    ? `${MONTHS_EN[Number(mo) - 1]} ${Number(d)}`
    : `${MONTHS_EN[Number(mo) - 1]} ${Number(d)}, ${y}`;
  const prefix = opts?.isOriginal === false ? "Added" : "Source";
  if (hh && mm && !(hh === "00" && mm === "00")) return `${prefix} ${day} ${hh}:${mm}`;
  return `${prefix} ${day}`;
}

/** English version of labels.formatReleaseWeek: "Streaming this Fri" etc. */
export function formatReleaseWeekEn(date: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return `${formatDateEn(date, now)} · streaming`;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)!.value);
  const today = Date.UTC(get("year"), get("month") - 1, get("day"));
  const monday = (d: number) => d - ((new Date(d).getUTCDay() + 6) % 7) * 86400000;
  const diff = (monday(target) - monday(today)) / (7 * 86400000);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(target).getUTCDay()];
  if (diff === 0) return `Streaming this ${weekday}`;
  if (diff === 1) return `Streaming next ${weekday}`;
  const nextMonth = new Date(Date.UTC(get("year"), get("month"), 1));
  if (Number(match[1]) === nextMonth.getUTCFullYear() && Number(match[2]) === nextMonth.getUTCMonth() + 1) {
    return `Streaming ${MONTHS_EN[Number(match[2]) - 1]} ${Number(match[3])}`;
  }
  return `${formatDateEn(date, now)} · streaming`;
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const PLATFORM_LABELS_EN: Record<string, string> = {
  netflix: "Netflix",
  "disney-plus": "Disney+",
  prime: "Prime Video",
  hulu: "Hulu",
  max: "Max",
  "apple-tv": "Apple TV+",
  iqiyi: "iQIYI",
  tencent: "Tencent Video",
  youku: "Youku",
  bilibili: "Bilibili",
  mubi: "MUBI",
  other: "Other",
};

export const RELEASE_STATUS_LABELS_EN: Record<string, string> = {
  announced: "",
  estimated: "Expected",
  tba: "TBA",
};

/** Chinese genre -> English. Unknown values pass through unchanged. */
export const GENRE_EN: Record<string, string> = {
  "剧情": "Drama",
  "传记": "Biography",
  "荣誉": "Honor",
  "评审": "Jury",
  "奇幻": "Fantasy",
  "冒险": "Adventure",
  "喜剧": "Comedy",
  "动作": "Action",
  "颁奖": "Awards",
  "惊悚": "Thriller",
  "纪录": "Documentary",
  "恐怖": "Horror",
  "沉浸": "Immersive",
  "短片": "Short",
  "悬疑": "Mystery",
  "动画": "Animation",
  "纪录片": "Documentary",
  "犯罪": "Crime",
  "历史": "History",
  "科幻": "Sci-Fi",
  "爱情": "Romance",
  "战争": "War",
  "西部": "Western",
  "音乐": "Music",
  "运动": "Sport",
  "家庭": "Family",
};

export function genreLabelEn(g: string): string {
  const t = (g || "").trim();
  if (!t) return "";
  return GENRE_EN[t] || t;
}

export function genreLabelsEn(genres: string[] | undefined): string[] {
  return (genres || []).map(genreLabelEn).filter(Boolean);
}

/** Chinese country -> English. */
export const COUNTRY_EN: Record<string, string> = {
  "英国": "UK",
  "美国": "US",
  "中国": "China",
  "罗马尼亚": "Romania",
  "俄罗斯": "Russia",
  "法国": "France",
  "德国": "Germany",
  "西班牙": "Spain",
  "波兰": "Poland",
  "日本": "Japan",
  "吉尔吉斯斯坦": "Kyrgyzstan",
  "巴勒斯坦": "Palestine",
  "韩国": "South Korea",
  "墨西哥": "Mexico",
  "香港": "Hong Kong",
  "台湾": "Taiwan",
  "意大利": "Italy",
  "加拿大": "Canada",
  "瑞典": "Sweden",
  "丹麦": "Denmark",
  "拉脱维亚": "Latvia",
  "比利时": "Belgium",
  "希腊": "Greece",
  "喀麦隆": "Cameroon",
  "伊朗": "Iran",
  "挪威": "Norway",
  "匈牙利": "Hungary",
  "巴西": "Brazil",
  "摩洛哥": "Morocco",
  "土耳其": "Türkiye",
  "奥地利": "Austria",
  "马来西亚": "Malaysia",
  "缅甸": "Myanmar",
  "捷克": "Czechia",
  "印尼": "Indonesia",
  "约旦": "Jordan",
  "泰国": "Thailand",
  "新加坡": "Singapore",
  "立陶宛": "Lithuania",
  "冰岛": "Iceland",
  "保加利亚": "Bulgaria",
  "中国香港": "Hong Kong",
  "哥伦比亚": "Colombia",
  "新西兰": "New Zealand",
};

export function countryLabelEn(c: string): string {
  return COUNTRY_EN[(c || "").trim()] || c;
}

/* ------------------------------------------------------------------ */
/* People: standard English names for well-established figures only.   */
/* Anyone not listed here keeps their Chinese name (never pinyin).     */
/* ------------------------------------------------------------------ */

export const PERSON_NAME_EN: Record<string, string> = {
  // Directors
  "三宅唱": "Sho Miyake",
  "丹尼·博伊尔": "Danny Boyle",
  "乔瓦尼·托尔托里奇": "Giovanni Tortorici",
  "亚历桑德罗·冈萨雷斯·伊尼亚里图": "Alejandro González Iñárritu",
  "亚历杭德罗·冈萨雷斯·伊尼亚里图": "Alejandro González Iñárritu",
  "安玛丽·贾西尔": "Annemarie Jacir",
  "维尔纳·赫尔佐格": "Werner Herzog",
  "马丁·麦克多纳": "Martin McDonagh",
  "白宗烈": "Baek Jong-yeol",
  "伊利亚·赫尔扎诺夫斯基": "Ilya Khrzhanovsky",
  "伊尔克·恰塔克": "Ilker Çatak",
  "伊曼努尔·马雷": "Emmanuel Mouret",
  "佩德罗·阿尔莫多瓦": "Pedro Almodóvar",
  "保罗·托马斯·安德森": "Paul Thomas Anderson",
  "克里斯托弗·诺兰": "Christopher Nolan",
  "克里斯蒂安·蒙吉": "Cristian Mungiu",
  "兰斯·哈默": "Lance Hammer",
  "兰斯·奥本海姆": "Lance Oppenheim",
  "冢本晋也": "Shinya Tsukamoto",
  "南尼·莫莱蒂": "Nanni Moretti",
  "卡西·阿弗莱克": "Casey Affleck",
  "哈维尔·卡尔沃": "Javier Calvo",
  "哈维尔·安布罗希": "Javier Ambrossi",
  "埃明·阿尔佩尔": "Emin Alper",
  "塞德里克·康": "Cédric Kahn",
  "奉俊昊": "Bong Joon Ho",
  "安娜玛丽·雅西尔": "Annemarie Jacir",
  "安德烈·萨金塞夫": "Andrey Zvyagintsev",
  "帕维乌·帕夫利科夫斯基": "Paweł Pawlikowski",
  "弗洛林·塞尔班": "Florin Șerban",
  "弗洛里安·泽勒": "Florian Zeller",
  "张律": "Zhang Lu",
  "托马索·兰杜奇": "Tommaso Landucci",
  "拉斯洛·奈迈施": "László Nemes",
  "是枝裕和": "Hirokazu Kore-eda",
  "朴赞郁": "Park Chan-wook",
  "李沧东": "Lee Chang-dong",
  "洪常秀": "Hong Sang-soo",
  "深田晃司": "Kōji Fukada",
  "滨口龙介": "Ryusuke Hamaguchi",
  "瓦莱斯卡·格里策巴赫": "Valeska Grisebach",
  "约阿希姆·特里尔": "Joachim Trier",
  "罗德里戈·索罗戈延": "Rodrigo Sorogoyen",
  "罗泓轸": "Na Hong-jin",
  "舒淇": "Shu Qi",
  "艾多阿尔多·德·安杰利斯": "Edoardo De Angelis",
  "詹姆斯·格雷": "James Gray",
  "许鞍华": "Ann Hui",
  "谢尔盖·洛兹尼察": "Sergei Loznitsa",
  "赵婷": "Chloé Zhao",
  "迈克·P·纳尔逊": "Mike P. Nelson",
  "迈克·李": "Mike Leigh",
  "迭戈·卢纳": "Diego Luna",
  "邱礼涛": "Herman Yau",
  "阿克坦·阿雷姆·库巴特": "Aktan Arym Kubat",
  "阿劳达·鲁伊斯·德·阿苏亚": "Alauda Ruiz de Azúa",
  "阿娃·杜威内": "Ava DuVernay",
  "阿斯哈·法哈蒂": "Asghar Farhadi",
  "陈哲艺": "Anthony Chen",
  "陈玉勋": "Chen Yu-hsun",
  "马丁·麦克唐纳": "Martin McDonagh",
  "马可·贝洛基奥": "Marco Bellocchio",
  "马吉德·马吉迪": "Majid Majidi",
  "黑泽清": "Kiyoshi Kurosawa",
  "杰奎琳·伦楚": "Jacqueline Lentzou",
  "格兰特·吉": "Grant Gee",
  "梅·埃尔-图希": "May el-Toukhy",
  "汉斯·彼得·莫兰德": "Hans Petter Moland",
  "沃纳·赫尔佐格": "Werner Herzog",
  "法提赫·阿金": "Fatih Akin",
  "玛丽·克鲁泽": "Marie Kreutzer",
  "瑞安·库格勒": "Ryan Coogler",
  "热纳维耶芙·迪吕德-德塞勒": "Geneviève Dulude-De Celles",
  "塔蒂亚娜·韦索": "Tatiana Huezo",
  "尼古拉斯·林孔·吉耶": "Nicolás Rincón Gille",
  "优瓦尔·亚伯拉罕": "Yuval Abraham",
  "胡安·塞巴斯蒂安·梅萨": "Juan Sebastián Mesa",
  "阿曼达·克内尔": "Amanda Kernell",
  "阿林娜·塞尔班": "Alina Șerban",
  "史蒂芬·布里泽": "Stéphane Brizé",
  "马库斯·施莱因策": "Markus Schleinzer",
  "佩德罗·阿尔莫多瓦尔": "Pedro Almodóvar",
  "尤瓦尔·亚伯拉罕": "Yuval Abraham",
  "罗泓轼": "Na Hong-jin",
  // Cast
  "乔·博恩瑟": "Joe Bernthal",
  "亚当·德赖弗": "Adam Driver",
  "全度妉": "Jeon Do-yeon",
  "史蒂夫·布西密": "Steve Buscemi",
  "斯嘉丽·约翰逊": "Scarlett Johansson",
  "汤姆·威茨": "Tom Waits",
  "格伦·克洛斯": "Glenn Close",
  "巴巴拉·莱尼": "Barbara Lennie",
  "帕克·波西": "Parker Posey",
  "李雪琴": "Li Xueqin",
  "洛拉·杜埃尼亚斯": "Lola Dueñas",
  "玛丽昂·贝利": "Marion Bailey",
  "米格尔·贝尔纳多": "Miguel Bernardeau",
  "艾塔娜·桑切斯-吉霍恩": "Aitana Sánchez-Gijón",
  "莱奥纳多·斯巴拉利": "Leonardo Sbaraglia",
  "莳田彩珠": "Ayu Makita",
  "萨姆·洛克威尔": "Sam Rockwell",
  "迈尔斯·特勒": "Miles Teller",
  "雷娜特·赖恩斯维": "Renate Reinsve",
  "乔治·克鲁尼": "George Clooney",
  "保罗·麦斯卡": "Paul Mescal",
  "克莱尔·芙伊": "Claire Foy",
  "全度妍": "Jeon Do-yeon",
  "具教焕": "Koo Kyo-hwan",
  "冈本多绪": "Tao Okamoto",
  "凯特·玛拉": "Kate Mara",
  "凯瑟琳·德纳芙": "Catherine Deneuve",
  "刘冠廷": "Kuan-Ting Liu",
  "哈维尔·巴登姆": "Javier Bardem",
  "塞巴斯蒂安·斯坦": "Sebastian Stan",
  "奥兹居·纳马尔": "Özge Namal",
  "姜其永": "Kang Ki-young",
  "娜奥米·沃茨": "Naomi Watts",
  "孙艺珍": "Son Ye-jin",
  "安妮·海瑟薇": "Anne Hathaway",
  "宋芸桦": "Vivian Sung",
  "宫馆凉太": "Ryota Miyadate",
  "小田切让": "Joe Odagiri",
  "希米什·帕特尔": "Himesh Patel",
  "张艺谋": "Zhang Yimou",
  "张震": "Chang Chen",
  "张颂文": "Zhang Songwen",
  "本·萨弗迪": "Ben Safdie",
  "本尼·埃曼努埃尔": "Benny Emmanuel",
  "本木雅弘": "Masahiro Motoki",
  "李秉宪": "Lee Byung-hun",
  "杨紫琼": "Michelle Yeoh",
  "杨雁雁": "Yeo Yann Yann",
  "杰克·奥康奈尔": "Jack O'Connell",
  "杰克逊·比尤斯": "Jackson Bews",
  "杰西·加西亚": "Jesse Garcia",
  "杰西·巴克利": "Jessie Buckley",
  "杰西卡·罗德": "Jessica Rothe",
  "林品彤": "Audrey Lin",
  "柄本佑": "Tasuku Emoto",
  "查理兹·塞隆": "Charlize Theron",
  "柯南·奥布赖恩": "Conan O'Brien",
  "柯斯莫·贾维斯": "Cosmo Jarvis",
  "桑德拉·惠勒": "Sandra Hüller",
  "梁家辉": "Tony Leung Ka-fai",
  "比尔·欧文": "Bill Irwin",
  "汤姆·克鲁斯": "Tom Cruise",
  "汤姆·考特尼": "Tom Courtenay",
  "汤姆·霍兰德": "Tom Holland",
  "泰扬娜·泰勒": "Teyana Taylor",
  "涩川清彦": "Kiyohiko Shibukawa",
  "特拉维斯·斯科特": "Travis Scott",
  "玛吉·吉伦哈尔": "Maggie Gyllenhaal",
  "琪亚娜·玛黛拉": "Kiana Madeira",
  "瑞恩·赫斯特": "Ryan Hurst",
  "瓦格纳·莫拉": "Wagner Moura",
  "瓦莱丽娅·布鲁尼·泰德斯基": "Valeria Bruni Tedeschi",
  "申承浩": "Shin Seung-ho",
  "皮尔弗兰切斯科·法维诺": "Pierfrancesco Favino",
  "盖·皮尔斯": "Guy Pearce",
  "科里·霍金斯": "Corey Hawkins",
  "米娅·高斯": "Mia Goth",
  "约翰·古德曼": "John Goodman",
  "约翰·雷吉扎莫": "John Leguizamo",
  "约翰·马尔科维奇": "John Malkovich",
  "维尔日妮·埃菲拉": "Virginie Efira",
  "罗丝·伯恩": "Rose Byrne",
  "罗伯特·帕丁森": "Robert Pattinson",
  "罗根·马歇尔-格林": "Logan Marshall-Green",
  "翁倩玉": "Judy Ongg",
  "耶拉·哈泽": "Jella Haase",
  "胡安·巴勃罗·舒克": "Juan Pablo Shuk",
  "艾伦·伯斯汀": "Ellen Burstyn",
  "艾利奥特·佩吉": "Elliot Page",
  "艾莉·范宁": "Elle Fanning",
  "范冰冰": "Fan Bingbing",
  "莫妮卡·贝鲁奇": "Monica Bellucci",
  "莱昂纳多·迪卡普里奥": "Leonardo DiCaprio",
  "菅田将晖": "Masaki Suda",
  "萨曼莎·莫顿": "Samantha Morton",
  "蒂莫西·柴勒梅德": "Timothée Chalamet",
  "蒔田彩珠": "Aju Makita",
  "蕾雅·赛杜": "Léa Seydoux",
  "薛景求": "Sol Kyung-gu",
  "西恩·潘": "Sean Penn",
  "贝尼西奥·德尔·托罗": "Benicio del Toro",
  "赞达亚": "Zendaya",
  "赵寅成": "Jo In-sung",
  "赵汝贞": "Cho Yeo-jeong",
  "路易·加莱尔": "Louis Garrel",
  "迈克尔·B·乔丹": "Michael B. Jordan",
  "邱泽": "Roy Chiu",
  "里兹·阿迈德": "Riz Ahmed",
  "里卡尔多·斯卡马尔乔": "Riccardo Scamarcio",
  "里贾纳·霍尔": "Regina Hall",
  "金敏喜": "Kim Min-hee",
  "钟雪莹": "Chung Suet-ying",
  "阮经天": "Ethan Juan",
  "阿德里亚娜·帕斯": "Adriana Paz",
  "阿斯塔·卡玛·奥古斯特": "Asta Kamma August",
  "阿方索·卡隆": "Alfonso Cuarón",
  "雷娜特·莱因斯维": "Renate Reinsve",
  "露皮塔·尼永奥": "Lupita Nyong'o",
  "青木崇高": "Takahiro Aoki",
  "马特·达蒙": "Matt Damon",
  "鲁妮·玛拉": "Rooney Mara",
  "余香凝": "Jennifer Yu",
  "伊尔塞·萨拉斯": "Ilse Salas",
  "吉原光夫": "Mitsuo Yoshihara",
  "吉高由里子": "Yuriko Yoshitaka",
  "坂东龙汰": "Ryota Bando",
  "坦苏·比切尔": "Tansu Biçer",
  "埃米·马迪根": "Amy Madigan",
  "佩内洛普·克鲁兹": "Penélope Cruz",
  "彭秀慧": "Kearen Pang",
  "斯泰兰·斯卡斯加德": "Stellan Skarsgård",
  "权海骁": "Kwon Hae-hyo",
  "中山裕介": "Yusuke Nakamura",
  "出口夏希": "Natsuki Deguchi",
  "安娜·考尔德-马歇尔": "Anna Calder-Marshall",
};

export function personNameEn(name: string): string {
  return PERSON_NAME_EN[(name || "").trim()] || name;
}

export function personNamesEn(names: string[] | undefined): string[] {
  return (names || []).map(personNameEn);
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

/** Chinese source label -> English. Proper nouns pass through. */
export const SOURCE_LABEL_EN: Record<string, string> = {
  "Netflix上新日历": "What's on Netflix",
  "定档追踪": "When To Stream",
  "片夜定档": "Movie of the Night",
  "片库·微博": "Film Library · Weibo",
  "微博": "Weibo",
  "好莱坞报道": "The Hollywood Reporter",
  "Apple TV 新闻": "Apple TV News",
};

export function sourceLabelEn(label?: string): string | undefined {
  const raw = label?.trim();
  if (!raw) return undefined;
  return SOURCE_LABEL_EN[raw] || raw;
}

/** Timeline badge mapping (Chinese -> English). */
export const BADGE_EN: Record<string, string> = {
  "新片": "New",
  "新品": "New",
  "定档": "Dated",
  "已上线": "Streaming",
  "上线计划": "Streaming planned",
};

export function badgeEn(label?: string): string | undefined {
  if (!label) return undefined;
  return BADGE_EN[label] || label;
}

/* ------------------------------------------------------------------ */
/* Film title / copy                                                   */
/* ------------------------------------------------------------------ */

/** Display title for English pages: official English title, else Chinese. */
export function filmTitleEn(film: Pick<Film, "title" | "titleEn">): string {
  return (film.titleEn || "").trim() || film.title;
}

/** Split English copy the same way splitFilmCopy splits Chinese copy.
 *  Structural decisions (award-only synopsis -> background) mirror the
 *  Chinese split, so English and Chinese pages stay in sync. */
export function splitFilmCopyEn(film: Film): { plot: string; background: string } {
  const backgroundEn = (film.backgroundEn || "").trim();
  const rawEn = (film.synopsisEn || "").trim();
  if (backgroundEn) {
    return { plot: rawEn, background: backgroundEn };
  }
  if (!rawEn) return { plot: "", background: "" };
  // Award-only Chinese synopsis (no background) -> English goes to background too.
  const zhSynopsis = (film.synopsis || "").trim();
  if (zhSynopsis && /第\d+届|荣誉金狮|评委主席|日程公布|长片报名/.test(zhSynopsis)) {
    return { plot: "", background: rawEn };
  }
  return { plot: rawEn, background: "" };
}

/** English indexability: needs real English prose (same 40-char bar as zh). */
export function isIndexableFilmEn(film: Film): boolean {
  const { plot, background } = splitFilmCopyEn(film);
  const content = `${plot} ${background}`;
  return content.replace(/\s+/g, " ").trim().length >= 40;
}

/* ------------------------------------------------------------------ */
/* UI strings for /en/ pages and locale-aware components               */
/* ------------------------------------------------------------------ */

export const UI_EN = {
  siteName: "Screen News",
  siteTagline: "Release dates · new film updates",
  navComingSoon: "Coming soon",
  navAbout: "About",
  footerTagline: "New film streaming dates · new film updates",
  footerNote:
    "Only when a film hits streaming, and when it goes on release; no box-office popcorn. Data ships with the repo, not scraped live.",
  footerOriginal: "Original",
  footerAllFilms: "All films",
  footerAbout: "About",
  footerContact: "Contact",
  footerPrivacy: "Privacy",
  footerNav: "readcine nav",
  copyright: "© 2026 ReadCine Editors",
  backToTimeline: "← Timeline",
  timeline: "Timeline",
  filmPage: "Film page →",
  personPage: "Profile →",
  newBadge: "New",
  blocked: "Blocked",
  blockedCount: (n: number) => `Blocked ${n}`,
  viewBlocked: "View",
  hideBlocked: "Hide blocked",
  clearBlocked: "Clear all blocks",
  undo: "↩ Undo",
  blockedMessage: (title: string) => `Blocked “${title}” and similar items`,
  like: "👍 Like",
  liked: "👍 Liked",
  notInterested: "✕ Not interested",
  unblock: "↩ Unblock",
  likeTitle: "Like: show more like this",
  unlikeTitle: "Unlike",
  blockTitle: "Don't recommend this or similar items",
  unblockTitle: "Unblock this and related items",
  blockReasonLabel: "Not interested because:",
  noMatch: "No timeline events match",
  lastSeen: "— You were here —",
  lastSeenAria: "Last seen here",
  moreFromFilm: (n: number) => `${n} more update${n === 1 ? "" : "s"} for this film`,
  collapseFilmHistory: "Collapse this film's history",
  sourcePrefix: "Source",
  guide: "🎞️ Guide",
  guideTitle: "View the guide on 观影导赏",
  guideInGuide: "🎞️ Read the guide on 观影导赏",
  weibo: "Weibo",
  weiboTitle: "View the original Weibo post",
  loadingSlow: "Loading slowly",
  openingDetail: "Opening details…",
  reopen: "Reopen",
  closeLoading: "Close loading notice",
  dismissTitle: "Don't recommend this?",
  dismissPlaceholder: "Tell us why — e.g. not my genre, already seen, want something different…",
  cancel: "Cancel",
  confirmDismiss: "Confirm",
  pullRefresh: "Pull to refresh",
  releaseToRefresh: "Release to refresh",
  refreshing: "Refreshing…",
  next: "Next",
  read: "Read · ",
  unread: "Unread · ",
  resumeNew: (n: number) => (
    `${n} new item${n === 1 ? "" : "s"} since your last visit`
  ),
  resumeNone: "Nothing new · you're all caught up",
  jumpToLastSeen: "Jump to where you left off ↓",
  lastSeenItem: (title: string) => `Last seen “${title}”`,
  nextRead: "Next (read) · ",
  nextUnread: "Next (unread) · ",
  prefsErrorCloud: "Cloud preferences failed to load; showing local records only",
  prefsErrorSync: "Cloud sync failed: saved locally, not synced to other devices",
  awardsTitle: "Verified awards & nominations",
  awardsWon: "Won",
  awardsNominated: "Nominated",
  plotTitle: "Plot",
  backgroundTitle: "Background",
  castCrewTitle: "Director & cast",
  directorTitle: "Director",
  castTitle: "Cast",
  streamingTitle: "Streaming",
  relatedTitle: "Related on this site",
  relatedNone: "No timeline events yet.",
  furtherReading: "Further reading",
  directorLabel: "Director",
  runtimeMinutes: (n: number) => `${n} min`,
  filmsTitle: "All films",
  filmsSubtitle: (n: number) => `${n} films · sorted by title`,
  comingSoonTitle: "Coming soon",
  comingSoonSubtitle: (n: number) => `${n} new films dated · grouped by release window`,
  bucketThisWeek: "This week",
  bucketNextWeek: "Next week",
  bucketRestOfMonth: "Rest of the month",
  bucketRestOfYear: "Rest of the year",
  bucketFilms: (n: number) => `${n} film${n === 1 ? "" : "s"}`,
  noReleases: "No new films in this window",
  eventMessageTitle: "This update",
  eventPlotTitle: "Plot summary",
  mergedTitle: (title: string) => `${title} (merged)`,
  mergedNote:
    "This page has been merged into the main film page and is redirecting automatically. If your browser doesn't redirect, use the link below:",
  mergedLink: (title: string) => `Go to the ${title} film page`,
  notFound: "Not found",
  streamingOn: (date: string) => `${date} · streaming`,
  streamingTba: "TBA",
  streamingExpected: (date: string) => `Expected ${date}`,
  yearSuffix: "",
} as const;

export type UiEn = typeof UI_EN;

/** Convert ISO dates left in translated English copy to "Nov 21" form. */
export function formatContentDatesEn(text: string, now = new Date()): string {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y, m, d) => formatDateEn(`${y}-${m}-${d}`, now));
}
