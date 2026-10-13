/**
 * 城市与机场三字码解析。
 *
 * 存在的理由：Amadeus 的询价接口只接受 IATA 三字码（如 PEK、NRT），
 * 而用户填的是「北京」「东京」这类中文城市名。这里做一层映射，
 * 查不到时给出可执行的提示（让用户直接填三字码），而不是静默失败。
 *
 * 覆盖范围目前以热门出行地为主；未收录的城市用户可直接填三字码绕过。
 */

/** 一个城市可对应的机场三字码（多机场城市取主用机场） */
interface CityEntry {
  /** IATA 城市码（Amadeus 的 cityCode） */
  code: string;
  /** 中文名 */
  names: string[];
}

/** 常用城市表。code 使用 IATA 城市码，多机场城市用城市码而非单个机场码 */
const CITIES: CityEntry[] = [
  // ---------- 中国内地 ----------
  { code: "BJS", names: ["北京", "北京市", "首都", "beijing"] },
  { code: "SHA", names: ["上海", "上海市", "shanghai"] },
  { code: "CAN", names: ["广州", "广州市", "guangzhou"] },
  { code: "SZX", names: ["深圳", "深圳市", "shenzhen"] },
  { code: "CTU", names: ["成都", "成都市", "chengdu"] },
  { code: "CKG", names: ["重庆", "重庆市", "chongqing"] },
  { code: "HGH", names: ["杭州", "杭州市", "hangzhou"] },
  { code: "NKG", names: ["南京", "南京市", "nanjing"] },
  { code: "WUH", names: ["武汉", "武汉市", "wuhan"] },
  { code: "XIY", names: ["西安", "西安市", "xian", "西安市区"] },
  { code: "CSX", names: ["长沙", "长沙市", "changsha"] },
  { code: "KMG", names: ["昆明", "昆明市", "kunming"] },
  { code: "XMN", names: ["厦门", "厦门市", "xiamen"] },
  { code: "TAO", names: ["青岛", "青岛市", "qingdao"] },
  { code: "TSN", names: ["天津", "天津市", "tianjin"] },
  { code: "CGO", names: ["郑州", "郑州市", "zhengzhou"] },
  { code: "SYX", names: ["三亚", "三亚市", "sanya"] },
  { code: "HAK", names: ["海口", "海口市", "haikou"] },
  { code: "LXA", names: ["拉萨", "拉萨市", "lhasa"] },
  { code: "URC", names: ["乌鲁木齐", "wulumuqi", "urumqi"] },
  { code: "HRB", names: ["哈尔滨", "haerbin", "harbin"] },
  { code: "SHE", names: ["沈阳", "shenyang"] },
  { code: "DLC", names: ["大连", "dalian"] },
  { code: "TNA", names: ["济南", "jinan"] },
  { code: "FOC", names: ["福州", "fuzhou"] },
  { code: "NNG", names: ["南宁", "nanning"] },
  { code: "KWE", names: ["贵阳", "guiyang"] },
  { code: "LJG", names: ["丽江", "lijiang"] },
  { code: "DLU", names: ["大理", "dali"] },
  { code: "ZAT", names: ["张家界", "zhangjiajie"] },
  { code: "JHG", names: ["西双版纳", "景洪", "xishuangbanna"] },
  { code: "HET", names: ["呼和浩特", "huhehaote"] },
  { code: "INC", names: ["银川", "yinchuan"] },
  { code: "XNN", names: ["西宁", "xining"] },
  { code: "LHW", names: ["兰州", "lanzhou"] },
  { code: "TYN", names: ["太原", "taiyuan"] },
  { code: "SJW", names: ["石家庄", "shijiazhuang"] },
  { code: "HFE", names: ["合肥", "hefei"] },
  { code: "NGB", names: ["宁波", "ningbo"] },
  { code: "WNZ", names: ["温州", "wenzhou"] },
  { code: "SWA", names: ["揭阳", "汕头", "shantou"] },
  { code: "ZUH", names: ["珠海", "zhuhai"] },
  { code: "MFM", names: ["澳门", "macau", "macao"] },
  { code: "HKG", names: ["香港", "hongkong", "hong kong"] },
  { code: "TPE", names: ["台北", "台北市", "taibei", "taipei"] },
  { code: "KHH", names: ["高雄", "kaohsiung"] },

  // ---------- 东北亚 ----------
  { code: "TYO", names: ["东京", "tokyo", "東京"] },
  { code: "OSA", names: ["大阪", "osaka", "大阪市"] },
  { code: "NGO", names: ["名古屋", "nagoya"] },
  { code: "CTS", names: ["札幌", "北海道", "sapporo", "hokkaido"] },
  { code: "FUK", names: ["福冈", "fukuoka"] },
  { code: "OKA", names: ["冲绳", "那霸", "okinawa", "naha"] },
  { code: "SEL", names: ["首尔", "汉城", "seoul"] },
  { code: "PUS", names: ["釜山", "busan"] },
  { code: "CJU", names: ["济州", "济州岛", "jeju"] },

  // ---------- 东南亚 ----------
  { code: "BKK", names: ["曼谷", "bangkok"] },
  { code: "HKT", names: ["普吉", "普吉岛", "phuket"] },
  { code: "CNX", names: ["清迈", "chiangmai", "chiang mai"] },
  { code: "SIN", names: ["新加坡", "singapore"] },
  { code: "KUL", names: ["吉隆坡", "kualalumpur", "kuala lumpur"] },
  { code: "DPS", names: ["巴厘岛", "登巴萨", "bali", "denpasar"] },
  { code: "MNL", names: ["马尼拉", "manila"] },
  { code: "CEB", names: ["宿务", "cebu"] },
  { code: "HAN", names: ["河内", "hanoi"] },
  { code: "SGN", names: ["胡志明", "胡志明市", "西贡", "ho chi minh", "saigon"] },
  { code: "DAD", names: ["岘港", "da nang", "danang"] },
  { code: "PNH", names: ["金边", "phnom penh"] },
  { code: "REP", names: ["暹粒", "吴哥", "siem reap"] },
  { code: "RGN", names: ["仰光", "yangon"] },
  { code: "VTE", names: ["万象", "vientiane"] },
  { code: "CGK", names: ["雅加达", "jakarta"] },

  // ---------- 南亚 / 中东 ----------
  { code: "DEL", names: ["德里", "新德里", "delhi"] },
  { code: "BOM", names: ["孟买", "mumbai"] },
  { code: "MLE", names: ["马尔代夫", "马累", "maldives", "male"] },
  { code: "CMB", names: ["科伦坡", "斯里兰卡", "colombo"] },
  { code: "KTM", names: ["加德满都", "尼泊尔", "kathmandu"] },
  { code: "DXB", names: ["迪拜", "dubai"] },
  { code: "AUH", names: ["阿布扎比", "abu dhabi"] },
  { code: "DOH", names: ["多哈", "doha"] },
  { code: "IST", names: ["伊斯坦布尔", "istanbul"] },
  { code: "TLV", names: ["特拉维夫", "tel aviv"] },

  // ---------- 欧洲 ----------
  { code: "LON", names: ["伦敦", "london"] },
  { code: "PAR", names: ["巴黎", "paris"] },
  { code: "ROM", names: ["罗马", "rome", "roma"] },
  { code: "MIL", names: ["米兰", "milan", "milano"] },
  { code: "VCE", names: ["威尼斯", "venice", "venezia"] },
  { code: "FCO", names: ["佛罗伦萨", "florence", "firenze"] },
  { code: "MAD", names: ["马德里", "madrid"] },
  { code: "BCN", names: ["巴塞罗那", "barcelona"] },
  { code: "LIS", names: ["里斯本", "lisbon", "lisboa"] },
  { code: "AMS", names: ["阿姆斯特丹", "amsterdam"] },
  { code: "BRU", names: ["布鲁塞尔", "brussels"] },
  { code: "FRA", names: ["法兰克福", "frankfurt"] },
  { code: "MUC", names: ["慕尼黑", "munich", "munchen"] },
  { code: "BER", names: ["柏林", "berlin"] },
  { code: "ZRH", names: ["苏黎世", "zurich"] },
  { code: "GVA", names: ["日内瓦", "geneva"] },
  { code: "VIE", names: ["维也纳", "vienna", "wien"] },
  { code: "PRG", names: ["布拉格", "prague", "praha"] },
  { code: "BUD", names: ["布达佩斯", "budapest"] },
  { code: "CPH", names: ["哥本哈根", "copenhagen"] },
  { code: "OSL", names: ["奥斯陆", "oslo"] },
  { code: "STO", names: ["斯德哥尔摩", "stockholm"] },
  { code: "HEL", names: ["赫尔辛基", "helsinki"] },
  { code: "KEF", names: ["雷克雅未克", "冰岛", "reykjavik"] },
  { code: "ATH", names: ["雅典", "athens"] },
  { code: "DUB", names: ["都柏林", "dublin"] },
  { code: "EDI", names: ["爱丁堡", "edinburgh"] },
  { code: "MOW", names: ["莫斯科", "moscow"] },
  { code: "LED", names: ["圣彼得堡", "st petersburg"] },

  // ---------- 北美 ----------
  { code: "NYC", names: ["纽约", "new york"] },
  { code: "WAS", names: ["华盛顿", "washington"] },
  { code: "BOS", names: ["波士顿", "boston"] },
  { code: "CHI", names: ["芝加哥", "chicago"] },
  { code: "LAX", names: ["洛杉矶", "los angeles"] },
  { code: "SFO", names: ["旧金山", "san francisco"] },
  { code: "SEA", names: ["西雅图", "seattle"] },
  { code: "LAS", names: ["拉斯维加斯", "las vegas"] },
  { code: "MIA", names: ["迈阿密", "miami"] },
  { code: "HNL", names: ["夏威夷", "檀香山", "honolulu", "hawaii"] },
  { code: "YVR", names: ["温哥华", "vancouver"] },
  { code: "YYZ", names: ["多伦多", "toronto"] },
  { code: "MEX", names: ["墨西哥城", "mexico city"] },

  // ---------- 大洋洲 / 非洲 / 南美 ----------
  { code: "SYD", names: ["悉尼", "sydney"] },
  { code: "MEL", names: ["墨尔本", "melbourne"] },
  { code: "BNE", names: ["布里斯班", "brisbane"] },
  { code: "AKL", names: ["奥克兰", "auckland"] },
  { code: "NAN", names: ["斐济", "楠迪", "fiji", "nadi"] },
  { code: "CAI", names: ["开罗", "cairo"] },
  { code: "CPT", names: ["开普敦", "cape town"] },
  { code: "JNB", names: ["约翰内斯堡", "johannesburg"] },
  { code: "NBO", names: ["内罗毕", "nairobi"] },
  { code: "MRU", names: ["毛里求斯", "mauritius"] },
  { code: "GRU", names: ["圣保罗", "sao paulo"] },
  { code: "EZE", names: ["布宜诺斯艾利斯", "buenos aires"] },
  { code: "LIM", names: ["利马", "lima"] },
  { code: "SCL", names: ["圣地亚哥", "santiago"] },
];

/** 中文名/英文名 → 城市码的索引，构建一次复用 */
const NAME_INDEX: Map<string, string> = (() => {
  const index = new Map<string, string>();

  for (const entry of CITIES) {
    index.set(entry.code.toLowerCase(), entry.code);

    for (const name of entry.names) {
      index.set(name.toLowerCase(), entry.code);
    }
  }

  return index;
})();

/** 城市解析结果 */
export interface ResolvedCity {
  /** 用户输入的原始文本 */
  input: string;
  /** IATA 城市码，形如 PEK / TYO */
  code: string;
  /** 是否由内置城市表命中；false 表示用户直接填了看起来合法的三字码 */
  matched: boolean;
}

/** 判断是否像 IATA 三字码：三位字母 */
export function looksLikeIata(value: string): boolean {
  return /^[A-Za-z]{3}$/.test(value.trim());
}

/**
 * 解析城市输入为 IATA 城市码。
 * 未收录的城市若本身就是三字码，则直接采用；否则返回 null。
 */
export function resolveCity(input: string): ResolvedCity | null {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const key = trimmed.toLowerCase();

  // 先查表：中文名、英文名、三字码都在同一张索引里
  const byName = NAME_INDEX.get(key);

  if (byName) {
    return { input: trimmed, code: byName, matched: true };
  }

  // 表里没有，但形如三字码时按机场/城市码直接使用，允许覆盖小众目的地
  if (looksLikeIata(trimmed)) {
    return { input: trimmed, code: trimmed.toUpperCase(), matched: false };
  }

  // 「北京大兴」这类带后缀的输入，尝试去掉后缀再匹配一次
  for (const suffix of ["市", "机场", "自治州", "地区"]) {
    if (trimmed.endsWith(suffix)) {
      const stripped = NAME_INDEX.get(trimmed.slice(0, -suffix.length).toLowerCase());

      if (stripped) {
        return { input: trimmed, code: stripped, matched: true };
      }
    }
  }

  return null;
}

/** 城市解析失败时统一抛这个错，便于接口层转成 400 */
export class CityResolveError extends Error {
  readonly field: string;
  readonly input: string;

  constructor(field: string, input: string) {
    super(
      `无法识别${field}「${input}」。请改用常见城市名（如 北京、东京、曼谷），或直接填写机场三字码（如 PEK、NRT、BKK）`,
    );
    this.name = "CityResolveError";
    this.field = field;
    this.input = input;
  }
}

/** 解析出发地与目的地，任一失败即抛 CityResolveError */
export function resolveTripCities(
  origin: string,
  destination: string,
): { origin: ResolvedCity; destination: ResolvedCity } {
  const resolvedOrigin = resolveCity(origin);

  if (!resolvedOrigin) {
    throw new CityResolveError("出发城市", origin);
  }

  const resolvedDestination = resolveCity(destination);

  if (!resolvedDestination) {
    throw new CityResolveError("目的地", destination);
  }

  return { origin: resolvedOrigin, destination: resolvedDestination };
}

/** 已收录的城市数量，便于在页面上提示覆盖范围 */
export function supportedCityCount(): number {
  return CITIES.length;
}
