/**
 * 旅行规划领域模型。
 *
 * 设计原则（与项目既有的「数字用代码算、文案交给模型」思路一致）：
 * - 所有金额、天数、人数结构都由确定性代码产生，模型只负责「排内容」
 * - 报价来源必须可追溯：live（真实报价）/ estimate（估算）逐一标注，
 *   避免把模型编的价格当真实价格展示给用户
 */

import type { IntercityOption } from "./intercityOptions";

/** 预算档位，决定分配权重与住宿档次 */
export type TravelStyle = "budget" | "comfort" | "premium" | "luxury";

/** 同行人构成：儿童通常免门票或半价，住宿需加床 */
export interface TravelParty {
  /** 成人数量 */
  adults: number;
  /** 儿童数量（按 2-12 岁估算票价与门票优惠） */
  children: number;
}

/** 表单输入，经 normalizeTripQuery 校验后变为可信输入 */
export interface TripQuery {
  /** 出发城市（可填中文城市名或三字码） */
  origin: string;
  /** 目的地城市（同上） */
  destination: string;
  /** 去程日期 YYYY-MM-DD */
  departDate: string;
  /** 返程日期 YYYY-MM-DD */
  returnDate: string;
  /** 同行人数 */
  party: TravelParty;
  /** 总预算，人民币元，覆盖全部同行人 */
  budget: number;
  /** 预算档位 */
  style: TravelStyle;
  /** 偏好标签，如 ["美食", "博物馆"] */
  interests: string[];
  /** 额外要求（自由文本，仅传给模型作为软约束） */
  notes?: string;
}

/** 行程天数结构，由日期推导，不允许调用方自行填写 */
export interface TripDuration {
  /** 在外住宿晚数 = 返程日 - 去程日 */
  nights: number;
  /** 行程天数（含首尾）= nights + 1 */
  days: number;
}

/** 报价可信度 */
export type QuoteConfidence = "live" | "estimate";

/** 单条报价的通用包装，便于前端统一标注来源 */
export interface QuoteMeta {
  confidence: QuoteConfidence;
  /** 数据提供方，如 "amadeus" / "heuristic" */
  provider: string;
  /** 面向用户的来源说明 */
  note: string;
  /** 报价抓取时间（ISO） */
  fetchedAt: string;
}

/** 航段信息 */
export interface FlightLeg {
  /** 出发机场三字码 */
  from: string;
  /** 到达机场三字码 */
  to: string;
  /** 起飞时间 ISO */
  departAt: string;
  /** 到达时间 ISO */
  arriveAt: string;
  /** 航司两字码 */
  carrier: string;
  /** 航班号 */
  flightNumber: string;
}

/** 机票方案 */
export interface FlightQuote extends QuoteMeta {
  /** 单人往返总价（人民币元） */
  pricePerAdult: number;
  /** 同行人合计（含儿童折扣） */
  totalPrice: number;
  /** 币种，恒为 CNY（已折算） */
  currency: "CNY";
  /** 去程航段 */
  outbound: FlightLeg[];
  /** 返程航段 */
  inbound: FlightLeg[];
  /** 全程耗时（分钟，去程+返程） */
  totalDurationMinutes: number;
  /** 经停次数 */
  stops: number;
}

/** 住宿方案 */
export interface HotelQuote extends QuoteMeta {
  name: string;
  /** 星级，未知为 null */
  rating: number | null;
  /** 每晚房价（人民币元，按整个订单房间数计） */
  pricePerNight: number;
  /** 住宿总价 = 每晚 × 晚数 */
  totalPrice: number;
  currency: "CNY";
  /** 需要预订的房间数 */
  rooms: number;
  /** 位置描述 */
  location?: string;
}

/** 报价聚合结果 */
export interface TravelQuotes {
  flight: FlightQuote | null;
  hotel: HotelQuote | null;
  /** 询价过程中出现的可读告警（不阻断主流程） */
  warnings: string[];
}

/** 经费科目 */
export type BudgetCategoryKey =
  | "transport"
  | "accommodation"
  | "food"
  | "activities"
  | "shopping"
  | "contingency";

/** 单个经费科目的分配结果 */
export interface BudgetCategory {
  key: BudgetCategoryKey;
  label: string;
  /** 分配金额（元，向下取整） */
  amount: number;
  /** 占总预算比例（0-1，四位小数） */
  ratio: number;
  /** 人均金额（元） */
  perPerson: number;
  /** 是否已由真实报价锁定（交通/住宿可能为 true） */
  lockedByQuote: boolean;
  /** 说明，如「含往返机票」或「按 4 晚 × 2 间估算」 */
  detail: string;
}

/** 预算分配结果 */
export interface BudgetPlan {
  /** 总预算 */
  total: number;
  currency: "CNY";
  categories: BudgetCategory[];
  /** 各项之和，理论上等于 total */
  allocated: number;
  /** 人均总花费 */
  perPerson: number;
  /** 人均每日花费 */
  perPersonPerDay: number;
  /** 最低可行预算（按该目的地/人数/天数的下限加总） */
  minimumViable: number;
  /** 预算是否不可行 */
  feasible: boolean;
  /** 预算诊断信息，面向用户展示 */
  diagnosis: string[];
}

/** 两个点位之间的通勤方案（接入高德后存在） */
export interface CommuteLeg {
  /** 起点名称 */
  from: string;
  /** 终点名称 */
  to: string;
  /** 距离（米） */
  distanceMeters: number;
  /** 耗时（分钟） */
  durationMinutes: number;
  /** 出行方式 */
  mode: "walk" | "transit" | "drive";
  /** 文字说明，如「地铁 8 号线，步行 400 米」 */
  summary: string;
  /** 驾车出行的预估打车费（元），仅 mode 为 drive 时由高德提供 */
  taxiCost?: number;
}

/** 单日活动安排 */
export interface ItineraryActivity {
  /** 开始时间 HH:mm */
  startTime: string;
  /** 结束时间 HH:mm */
  endTime: string;
  title: string;
  /** 类型：景点/餐饮/交通/体验/自由活动 */
  kind: "sight" | "meal" | "transport" | "experience" | "rest";
  /** 说明与实用提示 */
  description: string;
  /** 该活动预估花费（元，全团） */
  estimatedCost: number;
  /** 是否属于该科目的真实报价（通常 false） */
  costSource: QuoteConfidence;
  /** 地址或交通方式 */
  location?: string;
  /** 高德解析出的坐标 "lng,lat"，未接入地图时为空 */
  coordinates?: string;
  /** 高德整理后的规范地址 */
  address?: string;
  /** 从上一个活动到这里的通勤方案，未接入地图时为空 */
  commuteFromPrevious?: CommuteLeg;
}

/** 单日行程 */
export interface ItineraryDay {
  /** 第几天，从 1 开始 */
  day: number;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 当日主题 */
  theme: string;
  /** 当日活动 */
  activities: ItineraryActivity[];
  /** 当日预算（元，全团） */
  estimatedCost: number;
  /** 当日住宿说明 */
  accommodation: string;
  /** 当日提示 */
  tips?: string;
  /** 当日通勤段（相邻活动的连接），未接入地图时为空 */
  commuteLegs?: CommuteLeg[];
}

/** 单日天气预报（高德提供，仅中国境内） */
export interface DailyWeather {
  date: string;
  dayWeather: string;
  nightWeather: string;
  dayTemp: string;
  nightTemp: string;
  windDirection: string;
  windPower: string;
}

/** 完整旅行方案 */
export interface TravelPlan {
  query: TripQuery;
  duration: TripDuration;
  quotes: TravelQuotes;
  budget: BudgetPlan;
  /** 行程总览，一段话 */
  overview: string;
  /** 每日行程 */
  itinerary: ItineraryDay[];
  /** 行前准备清单 */
  checklist: string[];
  /** 出行提示（签证/季节/安全等） */
  tips: string[];
  /** 是否由模型生成行程内容 */
  generatedByAI: boolean;
  /** 使用的模型名 */
  model?: string;
  /** 生成时间 ISO */
  generatedAt: string;
  /** 面向用户的告警：降级原因、校验提示等 */
  warnings: string[];
  /** 逐日天气，仅在接入高德后存在 */
  weather?: DailyWeather[];
  /** 本次是否附带了真实地图数据（坐标与通勤） */
  mapEnriched?: boolean;
  /** 市内打车费合计（元），由高德驾车方案估算，已计入预算的交通科目 */
  mapTaxiCost?: number;
  /**
   * 跨城出行方案对比（火车 / 自驾）。
   *
   * 与 quotes.flight 的关系：flight 是「这一趟机票多少钱」，
   * 而本字段回答「有哪几种走法、各自多少钱多少时间」——
   * 国内中长途的实际主力是高铁，此前完全没有覆盖。
   */
  intercityOptions?: IntercityOption[];
}

