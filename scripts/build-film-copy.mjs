import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tmdbPath = path.join(root, "scripts/cache/tmdb-enrich.json");
const tmdb = fs.existsSync(tmdbPath)
  ? JSON.parse(fs.readFileSync(tmdbPath, "utf8"))
  : {};

/** TMDB ids that map to the wrong title — never use overview */
const BAD_TMDB = new Set([
  "busan-jury-2026-zhang-yimou",
  "honorary-yeoh",
  "busan-31-cuaron",
  "love-like-mine",
  "family-matters",
  "atlantic",
  "glimmer-girl",
  "nina-roza",
  "the-guest-kv",
  "the-housewife",
  "halima", // wrong match (Clint divorce)
]);

/** Clean TMDB overview boilerplate / complaint footer */
function cleanOverview(s) {
  if (!s) return "";
  return s
    .replace(/\s*投诉\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isChinese(s) {
  return /[\u4e00-\u9fff]/.test(s || "");
}

/** Hand-translated / curated Chinese synopses when TMDB is English-only or missing */
const SYNOPSIS_ZH = {
  "tender-loving-care":
    "社工艾米把心力几乎都花在需要帮助的家庭上，却逐渐发现自己的私人生活也在失序边缘。迈克·李以群戏与即兴排练捕捉当代英国福利与照护体系中的疲惫与温情。",
  "ghost-song":
    "十七岁的艾莎去世后，灵魂在生者与逝者之间游荡，试图与仍在哀悼的家人与朋友对话。法提赫·阿金以奇幻外壳书写移民家庭的失落与和解。",
  "woman-unknown":
    "前家政工玛丽筹划一场铺张的葬礼，却不愿让任何人知道她真正的身份与过去。梅·埃尔-图希借一场告别仪式，探讨阶级、尊严与被看见的权利。",
  "good-little-soldier":
    "四十三岁的高管卡拉在职场与家庭间维持完美表象，一次危机迫使她重新审视忠诚、服从与自我。史蒂芬·布里泽以冷峻社会剧质地书写当代中产压力。",
  "fire-inside":
    "多年前逃离那不勒斯的安东尼奥在别处重建生活，却因一桩旧事被拉回故土与家族恩怨。艾多阿尔多·德·安杰利斯继续书写南意大利的血缘与暴力余波。",
  "tonight-will-happen":
    "在奥斯陆，西娅与马泰奥等待孩子降生，却被突如其来的现实击中。南尼·莫莱蒂以个人化笔触书写父职、焦虑与欧洲当代家庭。",
  "falling-house":
    "德黑兰郊外一户普通人家，在经济与政治压力下眼看居所倾颓。拉蕾·马尔兹班等演员以克制表演呈现伊朗当代家庭的日常抵抗。",
  "children-of-the-monkey":
    "达里奥抚养残障孩子，却开始收到匿名威胁与邻里敌意。托马索·兰杜奇以家庭惊悚质地探讨恐惧如何在社区中传染。",
  "i-matter":
    "即将离开孤儿院的少女站在自立门槛上，试图证明自己「很重要」。阿林娜·塞尔班以罗马尼亚新浪潮余脉书写制度边缘的成长。",
  "jo-phaedra":
    "十五岁假小子乔做着关于费德拉的噩梦，现实与神话在青春期欲望与禁忌中交织。杰奎琳·伦楚以大胆形式实验书写少女主体。",
  "diane-in-the-loop":
    "黛安既渴望男人又厌恶男人；一次绕道的相遇把她卷入欲望与自我欺骗的循环。安·西罗与拉斐尔·巴尔博尼以黑色幽默拆解当代两性关系。",
  "house-of-the-wind":
    "八十岁的若塞特独自住在喀麦隆雅温得，孩子们散落各地，风穿过空屋。奥古斯特·贝尔纳·库埃莫·扬胡以静默影像书写离散家庭。",
  "place-to-heal":
    "法国公立医院青少年精神科，医生与病患在制度缝隙里寻找疗愈可能。塞德里克·康以纪录片式观察书写照护伦理。",
  "everybody-digs-bill-evans":
    "1961年纽约，传奇爵士钢琴家比尔·埃文斯录下改变爵士史的现场专辑前后。格兰特·吉以音乐传记片质地回访创造时刻。",
  "the-riverbank":
    "女人因亲人离世回到故乡河岸，往事与邻里关系重新浮现。马特乌·法里亚斯与埃诺克·卡瓦略以巴西地方风物书写哀悼。",
  "primetime":
    "纪录片导演兰斯·奥本海姆首部剧情长片，把真人秀逻辑推到极限：镜头如何制造真相，又如何吞没被拍摄者。",
  "company":
    "卡西·阿弗莱克自导自演，聚焦一间公司内部的权力、忠诚与道德模糊地带。威尼斯主竞赛亮相。",
  "bunker":
    "弗洛里安·泽勒（《父亲》《儿子》）新作，将心理惊悚置于封闭空间，探讨恐惧、记忆与幸存者叙事。",
  "mr-nelson":
    "冢本晋也以激烈影像质询战争责任：尼尔森先生，你杀人了吗？威尼斯主竞赛入围。",
  "hamnet":
    "莎士比亚与妻子艾格尼丝痛失十一岁儿子哈姆奈特。赵婷改编玛吉·奥法雷尔同名小说，以丧子之痛对照《哈姆雷特》的诞生。",
  "sinners":
    "1932年密西西比，双胞胎兄弟从芝加哥归来，用攒下的钱开起黑人酒吧；一夜狂欢演变成对抗种族暴力与超自然力量的血战。瑞安·库格勒执导。",
  "sentimental-value":
    "姐妹诺拉与阿格尼丝面对疏远多年的导演父亲古斯塔夫——他想让诺拉主演复出之作，遭拒后改邀美国明星。约阿希姆·特里尔书写家庭创伤与电影能否修好关系。",
  "weapons":
    "小镇在一夜之间失去一群孩子，社区陷入恐慌与猜疑。扎克·克雷格执导的恐怖群像，埃米·马迪根以配角戏份震动奖季。",
  "kpop-demon-hunters":
    "虚拟女团猎人穿越舞台与妖怪世界，以歌曲与战斗守护粉丝与人间。索尼动画与韩国流行文化碰撞的动作音乐动画。",
  "secret-agent":
    "冷战阴影下的特工在忠诚与背叛之间游走。影片以非英语语境重访间谍类型，金球奖季成为焦点。",
  "marty-supreme":
    "蒂莫西·柴勒梅德饰演一心称霸的桌球少年马蒂，在野心与自我神话之间狂奔。约什·萨夫迪执导的体育传记喜剧。",
  "if-i-had-legs":
    "罗丝·伯恩饰演濒临崩溃的母亲，在育儿、婚姻与精神压力中挣扎求存。玛丽·布朗斯坦以黑色幽默书写当代焦虑。",
  "a-foggy-tale":
    "陈玉勋以台湾乡土与黑色幽默，讲述大雾笼罩下的人情与命运错位。《大浜》获金马奖最佳剧情片。",
  "queerpanorama":
    "李骏硕以群像与都市碎片书写酷儿生存景观，金马奖最佳导演肯定其形式与议题的锋利度。",
  "lucky-lu":
    "张震饰演在命运十字路口徘徊的男人，于移民与家庭责任之间寻找「幸福之路」。",
  "mother-bhumi":
    "范冰冰饰演与土地、母性与权力缠斗的女性形象，《地母》以其表演力度拿下金马影后。",
  "catching-the-wind":
    "梁家辉在《捕风追影》中以成熟演技刻画游走法律与情义边缘的男人，摘下第44届金像奖影帝。",
  "minotaur":
    "安德烈·萨金塞夫以神话隐喻当代极权与迷宫般的社会结构，人在看不见的墙里寻找出口。",
  "fatherland":
    "帕维乌·帕夫利科夫斯基回望故土、记忆与历史暴力如何塑造一代人的面孔。",
  "our-redemption":
    "伊曼努尔·马雷书写一个「属于自己时代」的男人如何在道德账本上寻求救赎。",
  "moulin":
    "拉斯洛·奈迈施以极简光影与长镜头，把历史人物置于几乎抽象的空间中，延续其影像哲学。",
  "the-beloved":
    "罗德里戈·索罗戈延聚焦「所爱之人」关系中的失控、责任与西班牙社会的暗面。",
  "you-dont-belong-here":
    "弗洛林·塞尔班讲述格格不入者在体制与家庭缝隙中的挣扎，洛迦诺金豹肯定其锋利社会观察。",
  "salvation":
    "埃明·阿尔佩尔以土耳其当代政治与家庭伦理为底，追问救赎是否可能、代价由谁承担。",
  "rose-berlin":
    "桑德拉·惠勒饰演的罗丝在柏林的命运转折中寻找自我，柏林电影节以演技奖肯定其表演。",
  "box-mystery":
    "一个纸盒牵出层层谜团与人情债；张颂文以克制表演拿下上海金爵奖影帝。",
  "coward":
    "一战前线后方，青年士兵皮埃尔渴望证明勇气，却遇见必须「想办法处理」逃兵的弗朗西斯。影片以反战视角拆解勇气与懦弱的定义。",
  "pigeon-ring":
    "陶世欣、张妒琦的中国 VR 短片以鸽环为意象，探索沉浸叙事中的空间与记忆，威尼斯沉浸单元大奖。",
  "galerna":
    "两位选角导演穿越墨西哥偏远地区，为一部科幻片寻找非职业演员；塔蒂亚娜·韦索以纪录片式旅程书写再现与权力。",
  "lovers-go-home":
    "麦德林网络主播与残疾美国退伍军人在屏幕内外相遇，胡安·塞巴斯蒂安·梅萨书写跨境亲密与数字时代的归属。",
  "paper-tiger":
    "詹姆斯·格雷讲述一对兄弟在追逐美国梦时落入精心骗局：致富契机转眼成陷阱，兄弟情与道德底线一同被推到极限。",
  "digger":
    "亚历桑德罗·冈萨雷斯·伊尼亚里图新作：世上最有权势的男人极力证明自己是人类救世主，却迎来自己酝酿的灾难。",
  "the-odyssey":
    "克里斯托弗·诺兰改编荷马史诗：特洛伊战后，奥德修斯踏上归途，途经独眼巨人、塞壬与喀耳刻等试炼。全片以大画幅胶片拍摄。",
  "hope-na":
    "二十世纪七八十年代，非军事区附近被隔离的湖浦港村民，与不明外星生物对抗。罗泓轸将类型动作与韩国现代史阴影并置。",
  "naza":
    "约旦河西岸马萨费尔亚塔的年轻活动家巴塞尔·阿德拉，自幼反抗占领军对社群的大规模拆迁；优瓦尔·亚伯拉罕与蕾切尔·索尔以纪录长片追随抵抗日常。",
  "sheep-in-the-box":
    "近未来日本，中小型建筑公司总裁与同为建筑师的妻子在高度管理的社会里养育孩子；片名取自《小王子》。是枝裕和另一线创作。",
  "nagi-notes":
    "失落的雕塑家寄子在自然丰饶的凪町继续创作；东京与台湾两地奔忙的建筑师友梨前来担任雕塑模特，两人在沉默与海风中重新对齐节奏。深田晃司执导。",
  "bitter-christmas":
    "广告总监埃尔莎在母亲于十二月去世后以工作麻痹伤痛，一次惊恐发作迫使她停下。佩德罗·阿尔莫多瓦以节日气氛反衬哀悼。",
  "parallel-tales":
    "为给新小说找灵感，西尔维偷窥对面邻居，并雇年轻的亚当处理日常——却未料到对方藏着另一套人生剧本。阿斯哈·法哈蒂书写窥视与阶级。",
  "ketticè":
    "二十一世纪初的巴勒莫，一群少男少女直面青春期困境；在充满活力的西西里城市里，他们逐渐长成自己。乔瓦尼·托尔托里奇执导。",
  "queen-at-sea":
    "阿尔茨海默病逐渐剥夺一位女性表达自我的能力；丈夫与女儿竭力为她谋求尊严与出海般的自由。兰斯·哈默以极简影像书写照护。",
  "fruit-gathering":
    "工业仰光，年轻工厂女工桑琪在劳动与亲密关系中采撷微小希望。昂漂以缅甸当代现实书写女性主体。",
  "nowhere-to-lay-eyes":
    "尚熙时隔十年与弟弟赴济州探望母亲：餐馆大获成功，继父在拍片，目光无处安放。洪常秀以日常对话拆解家庭尴尬。",
  "goodbye-ufo":
    "1985年香港仔华富邨传出 UFO 低空飞过的都市传说。三个少年陈子健、何家谦、林可儿是目击者，也是成长的证人。梁柏堅以怀旧科幻质地回望八十年代香港。",
  "dau":
    "1950年代，娜塔莎在苏联秘密研究所食堂工作，科学家与外国访客穿梭其间。伊利亚·赫尔扎诺夫斯基以极端沉浸制作著称的 DAU 计划衍生长片。",
  "the-black-ball":
    "三个同性恋男子的故事横跨1932、1937与2017年的西班牙：欲望、压迫与自由在不同时代的「黑球」隐喻中回响。哈维尔·安布罗希与哈维尔·卡尔沃执导。",
  "the-dreamed-adventure":
    "生活在保加利亚、希腊与土耳其边境的女子为帮朋友卷入一桩特殊交易，自己也坠入危险。瓦莱斯卡·格里策巴赫书写边境女性的伦理抉择。",
  "black-red-yellow":
    "吉尔吉斯群山中，手艺最好的织毯女工图尔杜古尔织出的黑、红、黄不仅是图案，更是人们的命运线。阿克坦·阿雷姆·库巴特以工艺与神话织就民族史诗。",
  "gloaming-in-luomu":
    "小白收到西南小镇寄来的明信片，寄件人是三年前不辞而别的男友。她犹豫再三仍前往探寻。张律取景峨眉山罗目一带，以漫游节奏书写告别与余温。",
  "palestine-36":
    "1936年英属巴勒斯坦委任统治时期，农耕青年尤瑟夫每日往返村庄与耶路撒冷城内工作，在土地剥夺与殖民政策升温中寻找立足之地。安娜玛丽·雅西尔执导。",
  "all-of-a-sudden":
    "巴黎郊区养老院院长玛丽-露坚持推行更人文的护理；一次相遇让她结识身患癌症的日本导演麻里。两位女性因共同价值观与对语言的眷恋结成深厚友谊，也悄然改变整间机构。滨口龙介执导。",
  "yellow-letters":
    "安卡拉戏剧界备受瞩目的夫妇德丽娅与阿齐兹，因新戏首演后的政治压力一夜失去工作与住所，带着十三岁女儿暂居伊斯坦布尔亲属家。他坚持理想打零工，她寻找经济自立，婚姻与亲子关系同时被拉扯。",
  "two-seasons-two-strangers":
    "改编自柘植义春漫画。郁郁不得志的李编剧因缘际会来到大雪深山，误入破旧旅馆：屋顶压着积雪，老板笨造看起来毫无干劲。某夜，笨造带她踏入雪原——季节与陌生人改写了创作与孤独。",
  "look-back":
    "藤野与京本从小学一路走过十三年：因漫画结缘、互相激励，也因一场变故被迫重新理解创作与陪伴。是枝裕和改编藤本树短篇，于秋田等地实景拍摄。",
  "possible-love":
    "失业工人昊锡与妻子美玉，纪录片导演叡智与丈夫相宇——两对夫妇因拍摄纪录而相遇，阶级落差、隐性欲望与「可能的爱」在镜头内外同时展开。",
  "los-domingos":
    "十七岁的艾纳拉本该选定大学专业，却告诉家人自己与上帝的联系越来越近，想试探修道院生涯。家庭被这一召命拉裂。阿劳达·鲁伊斯·德·阿苏亚执导。",
  "fjord":
    "罗马尼亚裔父亲米哈伊与挪威籍母亲丽斯贝特带着五个孩子迁回峡湾小镇，本与邻居相处融洽；当少女埃利亚身上出现瘀伤，挪威儿童福利机构介入，严格宗教教养与国家监护理念正面碰撞。",
  "ink":
    "1969年，出版商鲁珀特·默多克收购英国日报《太阳报》，交给行事不择手段的拉里·兰姆经营，以竞争对手《镜报》为代价把销量打上去——小报的崛起也改写了后世媒体生态。",
  "one-battle":
    "曾经的革命者鲍勃带着女儿薇拉离网隐居，十六年来仍摆脱不了对危险的警惕。宿敌重新出现、女儿失踪后，他被迫联系旧日同伴，父子两代一起面对过去的代价。",
  "bucking-fastard":
    "一对形影不离的双胞胎姐妹在社会边缘挣扎求生。维尔纳·赫尔佐格灵感来自真实双胞胎故事，以近乎野兽般的生命力书写血缘与疯狂。",
  "wild-horse-nine":
    "1973年智利，性格迥异的中央情报局特工被派往复活节岛执行任务，搭档关系与地缘政治一同接受考验。马丁·麦克唐纳以黑色幽默与暴力诗学再探政治惊悚。",
  "atlantic":
    "钟凯峰以中国当代叙事书写跨洋情愫与命运分流，影像冷静而情绪暗涌；上海金爵奖肯定其整体完成度与摄影。",
};

/** Curated backgrounds: production / festival / adaptation — facts only */
const BACKGROUND = {
  fjord:
    "克里斯蒂安·蒙吉自编自导，灵感来自挪威真实儿童福利争议个案（影片中姓氏改为格奥尔基乌）。罗马尼亚／法国／挪威等跨国制作，片长约146分钟；塞巴斯蒂安·斯坦、雷娜特·莱因斯维主演。第79届戛纳主竞赛世界首映，获金棕榈及费比西奖等。",
  ink:
    "丹尼·博伊尔执导，詹姆斯·格雷厄姆改编自其2017年舞台剧。杰克·奥康奈尔饰拉里·兰姆，盖·皮尔斯饰默多克，克莱尔·芙伊饰记者朱尔斯。第83届威尼斯开幕并入围主竞赛；片长约116分钟。Netflix 拥有美国与拉美流媒体权益。",
  "one-battle":
    "保罗·托马斯·安德森自编自导，灵感来自托马斯·品钦小说《Vineland》。莱昂纳多·迪卡普里奥、西恩·潘、贝尼西奥·德尔·托罗等主演，片长约162分钟。2025年北美公映；第98届奥斯卡最佳影片、最佳导演。",
  "possible-love":
    "李沧东与吴贞美编剧。原题《가능한 사랑》。全度妍、薛景求、赵寅成、赵汝贞主演，片长约164分钟。创作酝酿多年，与韩国劳工抗争社会背景相关。第83届威尼斯评审团大奖与费比西奖；韩国院线后登陆 Netflix。",
  "look-back":
    "是枝裕和改编藤本树短篇漫画《蓦然回首》（ルックバック），真人版于秋田县等地实景拍摄。第83届威尼斯主竞赛入围。豆瓣／TMDB 通译《蓦然回首》。",
  "yellow-letters":
    "伊尔克·恰塔克（《教师休息室》）执导并与阿伊达·恰塔克、埃尼斯·科斯特彭编剧。德语片名 Gelbe Briefe，土耳其语对白，德／法／土合拍，片长约128分钟。第76届柏林金熊奖。",
  "two-seasons-two-strangers":
    "三宅唱执导，改编柘植义春漫画。原题《旅と日々》。第78届洛迦诺金豹奖。中文或译《旅途中的日子》。",
  "los-domingos":
    "阿劳达·鲁伊斯·德·阿苏亚执导。原题 Los domingos。第73届圣塞巴斯蒂安金贝壳。TMDB 简中《礼拜天》。",
  "hope-na":
    "罗泓轸执导。原题《호프》。第79届戛纳主竞赛。类型跨动作与科幻，同时回望韩国现代史氛围。",
  "gloaming-in-luomu":
    "张律执导，取景四川峨眉山罗目一带。白百何等出演。第30届釜山国际电影节竞赛最佳影片。",
  "black-red-yellow":
    "吉尔吉斯斯坦导演阿克坦·阿雷姆·库巴特执导。第27届上海国际电影节金爵奖最佳影片。",
  "palestine-36":
    "安娜玛丽·雅西尔执导的历史剧，背景为1936年巴勒斯坦大起义前后。第38届东京国际电影节东京大奖。",
  "all-of-a-sudden":
    "滨口龙介执导的法日合拍，维尔日妮·埃菲拉、冈本多绪等出演，片长约196分钟。第79届戛纳最佳女演员。",
  "bucking-fastard":
    "维尔纳·赫尔佐格剧情新作，鲁妮·玛拉、凯特·玛拉饰演双胞胎。第83届威尼斯主竞赛入围。中文或戏译《魂淡》。",
  "wild-horse-nine":
    "马丁·麦克唐纳执导，约翰·马尔科维奇等出演。第83届威尼斯主竞赛入围。",
  "the-odyssey":
    "克里斯托弗·诺兰改编《奥德赛》，全片大画幅／IMAX 胶片拍摄。未走三大竞赛，以作者向大制作进入奖季视线。",
  digger:
    "亚历桑德罗·冈萨雷斯·伊尼亚里图执导。作者向野心之作，关注权力、拯救叙事与灾难。",
  "tender-loving-care":
    "迈克·李确认的「最终长片」之一线创作，圣塞巴斯蒂安主竞赛并入选纽约电影节。英国社会现实主义脉络。",
  "ghost-song":
    "法提赫·阿金执导。第74届圣塞巴斯蒂安开幕并入围主竞赛。",
  "paper-tiger":
    "詹姆斯·格雷执导。第64届纽约电影节北美首映等作者向巡展节点。",
  naza:
    "优瓦尔·亚伯拉罕与蕾切尔·索尔纪录长片，延续其对占领与日常抵抗的关注。",
  "sheep-in-the-box":
    "是枝裕和创作线之一，片名取自《小王子》意象，近未来日本设定。",
  "bitter-christmas":
    "佩德罗·阿尔莫多瓦执导，节日气氛与哀悼并置。",
  "parallel-tales":
    "阿斯哈·法哈蒂执导；曾与「十诫」改编计划有渊源讨论，成片独立成篇。",
  "goodbye-ufo":
    "梁柏堅执导。第44届香港电影金像奖最佳电影、最佳导演。",
  "catching-the-wind":
    "梁家辉凭《捕风追影》获第44届金像奖最佳男主角。",
  "love-like-mine":
    "廖子妎凭本片获第44届金像奖最佳女主角。公开剧情资料有限，不编造细节。",
  hamnet:
    "赵婷执导，改编玛吉·奥法雷尔小说《哈姆奈特》。杰西·巴克利获第98届奥斯卡最佳女主角。",
  sinners:
    "瑞安·库格勒执导。第98届奥斯卡最佳男主角相关奖项节点。",
  "sentimental-value":
    "约阿希姆·特里尔执导。第98届奥斯卡最佳国际影片。",
  weapons:
    "埃米·马迪根凭本片获第98届奥斯卡最佳女配角。",
  "kpop-demon-hunters":
    "第98届奥斯卡最佳动画长片。",
  "secret-agent":
    "第83届金球奖剧情类男主角、最佳非英语片相关节点。",
  "marty-supreme":
    "蒂莫西·柴勒梅德获第83届金球奖音乐／喜剧类男主角。",
  "if-i-had-legs":
    "罗丝·伯恩获第83届金球奖音乐／喜剧类女主角。",
  "a-foggy-tale":
    "陈玉勋执导。《大浜》获第62届金马奖最佳剧情片。",
  queerpanorama:
    "李骏硕获第62届金马奖最佳导演。",
  "lucky-lu":
    "张震获第62届金马奖最佳男主角。",
  "mother-bhumi":
    "范冰冰获第62届金马奖最佳女主角。",
  "family-matters":
    "曾敬骊获第62届金马奖最佳男配角。公开完整剧情有限，不编造。",
  "honorary-clooney":
    "乔治·克鲁尼演员／导演／制片多栖，第83届威尼斯荣誉金狮致敬其银幕与公共影响力。",
  "honorary-burstyn":
    "艾伦·伯斯汀（《驱魔人》《爱丽丝不再住这里》等），第83届威尼斯荣誉金狮。",
  "venice-jury-2026":
    "玛吉·吉伦哈尔出任第83届威尼斯主竞赛评委主席；其导演作品亦受作者向影迷关注。",
  "honorary-yeoh":
    "杨紫琼获第76届柏林电影节荣誉金熊，致敬其跨越动作、剧情与国际合作的演艺生涯。",
  "busan-jury-2026-zhang-yimou":
    "张艺谋出任第31届釜山国际电影节主竞赛评审主席。",
  "busan-31-cuaron":
    "阿方索·卡隆出席第31届釜山国际电影节开幕并主持大师班，配合《地心引力》IMAX 特别放映。",
  "golden-horse-63":
    "第63届金马奖长片报名已于2026年7月开启；入围与典礼未举行前，时间线仅记报名节点。",
  "oscars-99":
    "第99届奥斯卡公布日程：提名 2027年1月21日，典礼 3月14日。时间线记日程发布，不提前虚构结果。",
  minotaur: "安德烈·萨金塞夫执导。第79届戛纳评审团大奖。",
  "the-dreamed-adventure": "瓦莱斯卡·格里策巴赫执导。第79届戛纳评审团奖。",
  "the-black-ball": "哈维尔·安布罗希、哈维尔·卡尔沃执导。第79届戛纳最佳导演。",
  fatherland: "帕维乌·帕夫利科夫斯基执导。第79届戛纳最佳导演。",
  coward: "第79届戛纳最佳男演员。一战题材反战剧。",
  "our-redemption": "伊曼努尔·马雷执导。第79届戛纳最佳编剧。",
  moulin: "拉斯洛·奈迈施执导。第79届戛纳主竞赛入围。",
  "the-beloved": "罗德里戈·索罗戈延执导。第79届戛纳主竞赛入围。",
  "you-dont-belong-here": "弗洛林·塞尔班执导。第79届洛迦诺金豹奖。",
  salvation: "埃明·阿尔佩尔执导。第76届柏林评审团大奖。",
  "rose-berlin": "马库斯·施莱因策执导线；桑德拉·惠勒获第76届柏林最佳主演。",
  "queen-at-sea": "兰斯·哈默执导，安娜·考尔德-马歇尔、汤姆·考特尼等出演。第76届柏林评审团奖。",
  "nina-roza": "热纳维耶芙·迪吕德-德塞勒执导。第76届柏林最佳编剧。公开完整剧情有限。",
  "box-mystery": "张颂文凭本片获第28届上海金爵奖最佳男演员。",
  atlantic: "钟凯峰执导。第28届上海金爵奖最佳影片、最佳摄影。",
  "glimmer-girl": "尼古拉斯·林孔·吉耶执导。第28届上海金爵奖评委会大奖。公开完整剧情有限。",
  "the-guest-kv": "马兹·门格尔执导。第60届卡罗维发利评审团特别奖。",
  "fruit-gathering": "昂漂执导。卡罗维发利等相关展映／奖项节点。",
  "tonight-will-happen": "南尼·莫莱蒂执导。第83届威尼斯主竞赛。",
  "mr-nelson": "冢本晋也执导。第83届威尼斯主竞赛。",
  bunker: "弗洛里安·泽勒执导。第83届威尼斯主竞赛。",
  company: "卡西·阿弗莱克执导。第83届威尼斯主竞赛。",
  primetime: "兰斯·奥本海姆首部剧情长片。第83届威尼斯主竞赛。",
  "place-to-heal": "塞德里克·康执导；玛卢·克比齐获马斯特罗亚尼奖相关节点。",
  dau: "伊利亚·赫尔扎诺夫斯基 DAU 计划衍生。第83届威尼斯相关单元。",
  "good-little-soldier": "史蒂芬·布里泽执导。第83届威尼斯最佳编剧。中文或译《优秀卒子》。",
  "fire-inside": "艾多阿尔多·德·安杰利斯执导。第83届威尼斯主竞赛。",
  "diane-in-the-loop": "安·西罗、拉斐尔·巴尔博尼执导。第83届威尼斯地平线最佳影片。",
  "jo-phaedra": "杰奎琳·伦楚执导。第83届威尼斯地平线最佳导演。",
  "house-of-the-wind": "奥古斯特·贝尔纳·库埃莫·扬胡执导。地平线评委会特别奖兼处女作奖。",
  "children-of-the-monkey": "托马索·兰杜奇执导。地平线最佳男演员与最佳编剧。",
  "falling-house": "拉蕾·马尔兹班凭本片获地平线最佳女演员。",
  "i-matter": "阿林娜·塞尔班执导。威尼斯相关单元奖项。",
  "pigeon-ring": "陶世欣、张妒琦中国 VR 短片。威尼斯沉浸单元大奖。",
  "woman-unknown": "梅·埃尔-图希执导。圣塞巴斯蒂安等作者向巡展。",
  "nagi-notes": "深田晃司执导。",
  "everybody-digs-bill-evans": "格兰特·吉执导的爵士钢琴家比尔·埃文斯相关传记片。",
  "the-riverbank": "马特乌·法里亚斯、埃诺克·卡瓦略执导。洛迦诺等展映节点。",
  ketticè: "乔瓦尼·托尔托里奇执导。",
  "nowhere-to-lay-eyes": "洪常秀执导。济州取景的家庭群像。",
  galerna: "塔蒂亚娜·韦索执导。圣塞巴斯蒂安产业单元 EGEDA Platino 等相关节点。",
  "lovers-go-home": "胡安·塞巴斯蒂安·梅萨执导。圣塞巴斯蒂安 WIP Latam 相关奖项节点。",
  "the-housewife": "本·希里尼安执导，娜奥米·沃茨主演；沃茨于圣塞巴斯蒂安获 Donostia 终身成就奖同场放映。",
};

const CAST = {
  fjord: ["塞巴斯蒂安·斯坦", "雷娜特·莱因斯维"],
  ink: ["杰克·奥康奈尔", "盖·皮尔斯", "克莱尔·芙伊"],
  "one-battle": ["莱昂纳多·迪卡普里奥", "西恩·潘", "贝尼西奥·德尔·托罗", "里贾纳·霍尔", "泰扬娜·泰勒", "Chase Infiniti"],
  "possible-love": ["全度妍", "薛景求", "赵寅成", "赵汝贞"],
  "look-back": ["出口夏希", "蒔田彩珠"],
  "yellow-letters": ["奥兹居·纳马尔", "坦苏·比切尔"],
  "all-of-a-sudden": ["维尔日妮·埃菲拉", "冈本多绪"],
  hamnet: ["杰西·巴克利", "保罗·麦斯卡"],
  sinners: ["迈克尔·B·乔丹"],
  "sentimental-value": ["伦妮·玛尔腾斯", "斯泰兰·斯卡斯加德", "艾莉·范宁"],
};

const DIRECTORS = {
  "one-battle": ["保罗·托马斯·安德森"],
  cowards: undefined,
  coward: [], // keep empty if unknown in seeds — filled below if we learn
};

const RUNTIME = {
  fjord: 146,
  ink: 116,
  "one-battle": 162,
  "possible-love": 164,
  "look-back": 100,
  "yellow-letters": 128,
  "two-seasons-two-strangers": 89,
  "all-of-a-sudden": 196,
  "los-domingos": 115,
  "hope-na": 157,
  "gloaming-in-luomu": 99,
  "black-red-yellow": 93,
  "palestine-36": 120,
  "the-odyssey": 173,
  digger: 129,
  "bucking-fastard": 109,
  "wild-horse-nine": 118,
  hamnet: 125,
  "paper-tiger": 115,
};

// Load all films
function loadFilms() {
  const files = [
    "films.json",
    "major-awards.json",
    "more-catalog.json",
    "extra-catalog.json",
    "density-pack.json",
  ];
  const films = [];
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(root, "src/data", f), "utf8"));
    if (Array.isArray(data)) films.push(...data);
    else if (data.films) films.push(...data.films);
  }
  return films;
}

const films = loadFilms();
const byId = new Map();
for (const f of films) byId.set(f.id, f);

const out = {};

for (const [id, film] of byId) {
  const entry = {};
  const t = tmdb[id];
  const bad = BAD_TMDB.has(id);

  // synopsis
  let syn = SYNOPSIS_ZH[id] || "";
  if (!syn && t && !bad) {
    const ov = cleanOverview(t.overview);
    if (ov && isChinese(ov) && ov.length >= 40) syn = ov;
  }
  // If still award-only short, leave synopsis empty (goes to background via split)
  const existing = (film.synopsis || "").trim();
  if (!syn && existing && existing.length >= 60 && !/第\d+届|荣誉金狮|评委主席|日程公布|长片报名/.test(existing)) {
    syn = existing;
  }
  if (syn) entry.synopsis = syn;

  // background
  let bg = BACKGROUND[id] || "";
  if (!bg && existing && /第\d+届|荣誉金狮|评委主席|日程公布|长片报名/.test(existing) && !syn) {
    bg = existing.replace(/暨纳/g, "戛纳");
  }
  if (bg) entry.background = bg.replace(/暨纳/g, "戛纳");

  // runtime
  const rt = RUNTIME[id] || (!bad && t && t.runtime && t.runtime >= 40 && t.runtime <= 240 ? t.runtime : undefined);
  if (rt) entry.runtime = rt;

  // cast / directors overlays
  if (CAST[id]) entry.cast = CAST[id];
  if (DIRECTORS[id] && DIRECTORS[id].length) entry.directors = DIRECTORS[id];

  // title polish from existing film-copy style
  if (Object.keys(entry).length) out[id] = entry;
}

// Preserve curated titles from old film-copy for key renames
const old = JSON.parse(fs.readFileSync(path.join(root, "src/data/film-copy.json"), "utf8"));
for (const [id, o] of Object.entries(old)) {
  if (!out[id]) out[id] = {};
  if (o.title) out[id].title = o.title;
  if (o.titleEn) out[id].titleEn = o.titleEn;
  if (o.directors && !out[id].directors) out[id].directors = o.directors;
  if (o.cast && !out[id].cast) out[id].cast = o.cast;
  // Prefer new synopsis/background; else keep old if better
  if (!out[id].synopsis && o.synopsis && o.synopsis.length >= 40) out[id].synopsis = o.synopsis;
  if (!out[id].background && o.background) out[id].background = o.background;
}

const dest = path.join(root, "src/data/film-copy.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

let withBoth = 0, withSyn = 0, withBg = 0;
for (const e of Object.values(out)) {
  if (e.synopsis) withSyn++;
  if (e.background) withBg++;
  if (e.synopsis && e.background) withBoth++;
}
console.log(JSON.stringify({ films: Object.keys(out).length, withSyn, withBg, withBoth }, null, 2));
