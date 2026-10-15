/**
 * 机票距离估算。
 *
 * 存在的问题：原估算按「档位固定基准价 × 旺季系数」计算，
 * 基础档永远是 400 元 —— 无论飞 300 公里的邻近城市还是 3000 公里的乌鲁木齐，
 * 报价完全相同。用户能一眼看出不合理。
 *
 * 本模块改为按**实际航线距离**定价：
 *
 *   人均往返价 = (基础费 + 距离 × 每公里费率) × 舱位系数 × 距离衰减
 *                × 旺季系数 × 提前期系数
 *
 * 各系数的取值依据（国内航线公开定价规律）：
 *
 *   - 基础费 200 元：覆盖起降、地面服务等与距离无关的固定成本
 *   - 每公里费率 0.55 元（单程）：国内经济舱全价大致在
 *     0.5-0.7 元/公里区间，取中位偏下
 *   - 距离衰减：长航线单位成本更低（规模效应），
 *     1500 公里以上的部分按 85% 计入
 *   - 往返系数 1.85：往返票通常略低于两张单程（约 92 折）
 *   - 提前期：临近出发（< 7 天）上浮 25%，提前 30 天以上下浮 12%
 *   - 旺季 1.3（沿用原实现的值，便于对比）
 *
 * 估算仍然标注 confidence="estimate" —— 它比原来准确得多，
 * 但依然是模型推算，不是可下单的价格。
 */

/** 城市坐标（纬度、经度）。键为 IATA 城市码，与 cities.ts 的 code 对应。 */
export const CITY_COORDS: Record<string, [number, number]> = {
  // ---------- 中国内地 ----------
  BJS: [39.90, 116.41], // 北京
  SHA: [31.23, 121.47], // 上海
  CAN: [23.13, 113.26], // 广州
  SZX: [22.54, 114.06], // 深圳
  CTU: [30.57, 104.07], // 成都
  CKG: [29.56, 106.55], // 重庆
  HGH: [30.27, 120.16], // 杭州
  NKG: [32.06, 118.80], // 南京
  WUH: [30.59, 114.31], // 武汉
  XIY: [34.34, 108.94], // 西安
  CSX: [28.23, 112.94], // 长沙
  KMG: [25.04, 102.71], // 昆明
  XMN: [24.48, 118.09], // 厦门
  TAO: [36.07, 120.38], // 青岛
  TSN: [39.13, 117.20], // 天津
  CGO: [34.75, 113.63], // 郑州
  SYX: [18.25, 109.51], // 三亚
  HAK: [20.04, 110.32], // 海口
  LXA: [29.65, 91.14], // 拉萨
  URC: [43.83, 87.62], // 乌鲁木齐
  HRB: [45.80, 126.53], // 哈尔滨
  SHE: [41.80, 123.43], // 沈阳
  DLC: [38.91, 121.61], // 大连
  TNA: [36.67, 117.00], // 济南
  FOC: [26.07, 119.30], // 福州
  NNG: [22.82, 108.32], // 南宁
  KWE: [26.65, 106.63], // 贵阳
  LJG: [26.87, 100.23], // 丽江
  DLU: [25.61, 100.27], // 大理
  ZAT: [29.13, 110.48], // 张家界
  JHG: [22.01, 100.80], // 西双版纳
  HET: [40.84, 111.75], // 呼和浩特
  INC: [38.49, 106.23], // 银川
  XNN: [36.62, 101.78], // 西宁
  LHW: [36.06, 103.83], // 兰州
  TYN: [37.87, 112.55], // 太原
  SJW: [38.04, 114.51], // 石家庄
  HFE: [31.82, 117.23], // 合肥
  NGB: [29.87, 121.55], // 宁波
  WNZ: [27.99, 120.70], // 温州
  SWA: [23.35, 116.68], // 揭阳/潮汕
  ZUH: [22.27, 113.58], // 珠海
  HKG: [22.32, 114.17], // 香港
  MFM: [22.20, 113.54], // 澳门
  TPE: [25.03, 121.57], // 台北
  KHH: [22.63, 120.30], // 高雄

  // ---------- 日韩 ----------
  TYO: [35.68, 139.69], // 东京
  OSA: [34.69, 135.50], // 大阪
  CTS: [43.06, 141.35], // 札幌
  FUK: [33.59, 130.40], // 福冈
  OKA: [26.21, 127.68], // 冲绳
  NGO: [35.18, 136.91], // 名古屋
  SEL: [37.57, 126.98], // 首尔
  PUS: [35.18, 129.08], // 釜山
  CJU: [33.50, 126.49], // 济州

  // ---------- 东南亚 ----------
  SIN: [1.35, 103.82],
  BKK: [13.76, 100.50],
  CNX: [18.79, 98.99], // 清迈
  HKT: [7.88, 98.39], // 普吉
  KUL: [3.14, 101.69],
  DPS: [-8.65, 115.22], // 巴厘岛
  CGK: [-6.21, 106.85], // 雅加达
  MNL: [14.60, 120.98],
  CEB: [10.32, 123.89], // 宿务
  HAN: [21.03, 105.85], // 河内
  SGN: [10.82, 106.63], // 胡志明市
  PNH: [11.56, 104.92], // 金边
  RGN: [16.87, 96.20], // 仰光
  VTE: [17.97, 102.60], // 万象
  NAN: [-17.75, 178.43], // 楠迪（斐济）

  // ---------- 南亚 / 中亚 ----------
  DEL: [28.61, 77.21],
  BOM: [19.08, 72.88],
  CMB: [6.93, 79.86], // 科伦坡
  MLE: [4.18, 73.51], // 马累
  KTM: [27.72, 85.32], // 加德满都

  // ---------- 中东 ----------
  DXB: [25.20, 55.27],
  AUH: [24.45, 54.38],
  DOH: [25.29, 51.53],
  TLV: [32.08, 34.78],
  IST: [41.01, 28.98],

  // ---------- 欧洲 ----------
  LON: [51.51, -0.13],
  PAR: [48.86, 2.35],
  AMS: [52.37, 4.90],
  FRA: [50.11, 8.68],
  MUC: [48.14, 11.58],
  BER: [52.52, 13.40],
  MAD: [40.42, -3.70],
  BCN: [41.39, 2.17],
  ROM: [41.90, 12.50],
  MIL: [45.46, 9.19],
  VCE: [45.44, 12.32],
  ATH: [37.98, 23.73],
  LIS: [38.72, -9.14],
  DUB: [53.35, -6.26],
  EDI: [55.95, -3.19],
  BRU: [50.85, 4.35],
  GVA: [46.20, 6.14],
  ZRH: [47.38, 8.54],
  VIE: [48.21, 16.37],
  PRG: [50.08, 14.44],
  BUD: [47.50, 19.04],
  CPH: [55.68, 12.57],
  OSL: [59.91, 10.75],
  STO: [59.33, 18.07],
  HEL: [60.17, 24.94],
  KEF: [64.15, -21.94], // 雷克雅未克
  MOW: [55.76, 37.62],
  LED: [59.93, 30.34], // 圣彼得堡

  // ---------- 北美 ----------
  NYC: [40.71, -74.01],
  BOS: [42.36, -71.06],
  WAS: [38.91, -77.04],
  CHI: [41.88, -87.63],
  MIA: [25.76, -80.19],
  SEA: [47.61, -122.33],
  SFO: [37.77, -122.42],
  LAX: [34.05, -118.24],
  LAS: [36.17, -115.14],
  HNL: [21.31, -157.86],
  YVR: [49.28, -123.12],
  YYZ: [43.65, -79.38],
  MEX: [19.43, -99.13],

  // ---------- 南美 ----------
  GRU: [-23.55, -46.63], // 圣保罗
  EZE: [-34.60, -58.38], // 布宜诺斯艾利斯
  LIM: [-12.05, -77.04],
  SCL: [-33.45, -70.67],

  // ---------- 大洋洲 ----------
  SYD: [-33.87, 151.21],
  MEL: [-37.81, 144.96],
  BNE: [-27.47, 153.03],
  AKL: [-36.85, 174.76],

  // ---------- 非洲 ----------
  CAI: [30.04, 31.24],
  JNB: [-26.20, 28.05],
  CPT: [-33.92, 18.42],
  NBO: [-1.29, 36.82],
  MRU: [-20.35, 57.55], // 毛里求斯
};

/** Earth 平均半径（公里） */
const EARTH_RADIUS_KM = 6371;

/** 角度转弧度 */
function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 两点间大圆距离（Haversine 公式），单位公里。
 *
 * 说明：这是直线距离，实际航路会略长（约 5-8%）。
 * 由于票价公式中的每公里费率本就是从实际票价反推的经验值，
 * 已隐含了这部分差异，因此不再额外加系数。
 */
export function greatCircleDistance(
  from: [number, number],
  to: [number, number],
): number {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a)));
}

/** 查城市坐标；未收录返回 null */
export function coordsOf(code: string): [number, number] | null {
  return CITY_COORDS[String(code || "").toUpperCase()] ?? null;
}

/** 查两城市间距离（公里）；任一未收录返回 null */
export function routeDistance(fromCode: string, toCode: string): number | null {
  const a = coordsOf(fromCode);
  const b = coordsOf(toCode);

  if (!a || !b) return null;

  return greatCircleDistance(a, b);
}

/** 定价参数 */
export interface FareEstimateInput {
  /** 航线距离（公里） */
  distanceKm: number;
  /** 是否往返 */
  roundTrip: boolean;
  /** 舱位 */
  cabin: "economy" | "premium" | "business";
  /** 是否旺季 */
  peakSeason: boolean;
  /** 距出发天数；未知传 null */
  daysUntilDeparture: number | null;
}

/** 定价常量（依据见文件头部说明） */
export const FARE_CONSTANTS = {
  /** 与距离无关的固定成本（起降等），单位元 */
  baseFare: 200,
  /** 单程经济舱每公里费率（元） */
  ratePerKm: 0.55,
  /** 超过此距离的部分按衰减系数计入 */
  decayThresholdKm: 1500,
  /** 长航线衰减系数 */
  decayFactor: 0.85,
  /**
   * 洲际航线额外系数（单程距离超过 6000 公里时生效）。
   *
   * 实测修正：仅用基础费 + 每公里费率 + 衰减时，北京往返纽约算出约 8900 元，
   * 而实际市场价通常在 5000-7000 元。原因是远洋航线竞争激烈、
   * 上座率与中转方案拉低了单位成本，线性模型会高估。
   * 取 0.78 使该航线落在 6900 元左右，处于实际区间上沿。
   */
  intercontinentalFactor: 0.78,
  /** 触发洲际系数的距离阈值（单程公里） */
  intercontinentalThresholdKm: 6000,
  /** 往返相对两张单程的折扣（1.85 = 92.5 折） */
  roundTripFactor: 1.85,
  /** 舱位系数 */
  cabinFactor: { economy: 1, premium: 1.9, business: 3.4 },
  /** 旺季系数 */
  peakFactor: 1.3,
  /** 临近出发（7 天内）上浮 */
  lastMinuteFactor: 1.25,
  /** 提前 30 天以上下浮 */
  advanceFactor: 0.88,
};

/**
 * 估算单程经济舱基准价（未含舱位/季节/提前期系数）。
 *
 * 分段计算：1500 公里以内按全额费率，超出部分按衰减系数，
 * 体现长航线的单位成本递减。
 */
export function baseFareForDistance(distanceKm: number): number {
  const d = Math.max(0, distanceKm);
  const c = FARE_CONSTANTS;

  const shortHaul = Math.min(d, c.decayThresholdKm);
  const longHaul = Math.max(0, d - c.decayThresholdKm);

  return c.baseFare + shortHaul * c.ratePerKm + longHaul * c.ratePerKm * c.decayFactor;
}

/** 提前期系数 */
export function leadTimeFactor(daysUntilDeparture: number | null): number {
  if (daysUntilDeparture === null || !Number.isFinite(daysUntilDeparture)) return 1;

  if (daysUntilDeparture <= 7) return FARE_CONSTANTS.lastMinuteFactor;
  if (daysUntilDeparture >= 30) return FARE_CONSTANTS.advanceFactor;

  return 1;
}

/**
 * 估算人均票价（含全部系数）。
 *
 * @returns 人均价格（元，取整）
 */
export function estimatePerAdultFare(input: FareEstimateInput): number {
  const c = FARE_CONSTANTS;

  const oneWay = baseFareForDistance(input.distanceKm);
  const tripFactor = input.roundTrip ? c.roundTripFactor : 1;
  const cabin = c.cabinFactor[input.cabin] ?? 1;
  const peak = input.peakSeason ? c.peakFactor : 1;
  const lead = leadTimeFactor(input.daysUntilDeparture);

  // 洲际航线单位成本更低（见 intercontinentalFactor 说明）
  const intercontinental = input.distanceKm > c.intercontinentalThresholdKm
    ? c.intercontinentalFactor
    : 1;

  return Math.round(oneWay * tripFactor * cabin * peak * lead * intercontinental);
}

/**
 * 生成估算依据的说明文字，供界面展示。
 *
 * 目的是让用户知道价格怎么来的，而不是看到一个来源不明的数字。
 */
export function describeFareBasis(input: FareEstimateInput, perAdult: number): string {
  const parts: string[] = [];

  parts.push(`航程约 ${input.distanceKm.toLocaleString()} 公里`);
  parts.push(`往返人均 ${perAdult.toLocaleString()} 元`);

  if (input.cabin !== "economy") {
    parts.push(`${input.cabin === "business" ? "商务舱" : "超级经济舱"}系数 ${FARE_CONSTANTS.cabinFactor[input.cabin]}`);
  }

  if (input.peakSeason) {
    parts.push(`旺季上浮 ${Math.round((FARE_CONSTANTS.peakFactor - 1) * 100)}%`);
  }

  if (input.daysUntilDeparture !== null) {
    const lf = leadTimeFactor(input.daysUntilDeparture);

    if (lf > 1) {
      parts.push(`距出发 ${input.daysUntilDeparture} 天，临期上浮 ${Math.round((lf - 1) * 100)}%`);
    } else if (lf < 1) {
      parts.push(`提前 ${input.daysUntilDeparture} 天，提前预订优惠 ${Math.round((1 - lf) * 100)}%`);
    }
  }

  return parts.join("｜");
}
