/**
 * 旅行方案导出：把 TravelPlan 整理成「文档友好的结构」。
 *
 * 为什么先整理再渲染：docx 的渲染代码不易测试（产物是二进制），
 * 而「取哪些字段、怎么排序、金额怎么格式化」这些逻辑才是容易出错的地方。
 * 拆开后前者可用单测覆盖，渲染层只做机械映射。
 *
 * 与界面展示的差异：网页是交互式阅读，文档是线性阅读且要能打印。
 * 因此这里会补上界面里靠交互才能看到的信息（如房型明细、通勤方式），
 * 并去掉只在网页有意义的元素（按钮、链接样式）。
 */

import type { RoomOption } from "./rollinggo";
import type { IntercityOption } from "./intercityOptions";
import type { TravelPlan } from "./types";

/** 文档里的一个键值对 */
export interface DocFact {
  label: string;
  value: string;
}

/** 文档里的一个区块 */
export interface DocSection {
  title: string;
  /** 段落文字 */
  paragraphs?: string[];
  /** 键值对（横向排布） */
  facts?: DocFact[];
  /** 列表项 */
  bullets?: string[];
  /** 表格：第一行为表头 */
  table?: { headers: string[]; rows: string[][] };
  /**
   * 区块所属的行程日（用于在文档里嵌入该日的路线图）。
   * 只有逐日行程区块会带这个字段。
   */
  day?: number;
}

/**
 * 导出选项。
 *
 * 三种模式对应不同使用场景：
 *   · full    完整行程单（默认）—— 打印/存档
 *   · compact 精简版 —— 只要概览、报价与每日要点，适合转发或快速查看
 *   · day     单日 —— 当天出行时只看那一天
 */
export interface ExportOptions {
  mode?: "full" | "compact" | "day";
  /** mode 为 day 时指定第几天（从 1 开始） */
  day?: number;
  /** 是否嵌入逐日路线图（默认嵌入） */
  includeMaps?: boolean;
}

/** 解析后的导出选项（带默认值） */
interface ResolvedOptions {
  mode: "full" | "compact" | "day";
  day: number | null;
  includeMaps: boolean;
}

/** 归一化导出选项，非法值退回默认 */
export function resolveExportOptions(options: ExportOptions = {}): ResolvedOptions {
  const wantsDay = Number.isInteger(options.day) && (options.day ?? 0) > 0;

  /**
   * 模式判定顺序：
   *   1. 显式指定 compact → compact
   *   2. 指定了合法的 day → day（无论 mode 传没传）
   *   3. 显式指定 day 但 day 非法 → 退回 full
   *   4. 其余 → full
   *
   * 第 2 条是必要的：调用方常只传 day（如 URL 上只有 ?day=2），
   * 若要求必须同时传 mode，漏传就会静默返回整份文档。
   */
  let mode: ResolvedOptions["mode"];

  if (options.mode === "compact") {
    mode = "compact";
  } else if (wantsDay) {
    mode = "day";
  } else {
    mode = "full";
  }

  return {
    mode,
    day: mode === "day" ? (options.day as number) : null,
    includeMaps: options.includeMaps !== false,
  };
}

/** 文档标题信息 */
export interface DocHeader {
  title: string;
  subtitle: string;
}

/** 完整的文档结构 */
export interface PlanDocument {
  header: DocHeader;
  sections: DocSection[];
  /** 生成时间说明 */
  footer: string;
  /** 实际采用的导出选项（供文件名与日志使用） */
  options: ResolvedOptions;
}

/** 把分钟格式化为「4小时24分」 */
function durationText(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return h > 0 ? `${h}小时${m}分` : `${m}分`;
}

/** 报价可信度的中文标注 */
function confidenceText(confidence: string): string {
  return confidence === "live" ? "实时报价" : "估算";
}

/**
 * 把方案整理为文档结构。
 *
 * 区块顺序按「先结论后细节」：
 *   概览 → 交通住宿报价 → 跨城方式 → 预算 → 逐日行程 → 行前准备 → 提示
 * 这样打印出来第一页就能看到关键信息。
 */
export function buildPlanDocument(plan: TravelPlan, options: ExportOptions = {}): PlanDocument {
  const { query, duration, budget, quotes, itinerary } = plan;

  const opts = resolveExportOptions(options);

  const headcount = query.party.adults + query.party.children;

  // 单日模式：只保留指定那天，标题与副标题也相应收窄。
  // 指定了不存在的天数时 days 为空数组 —— 此时文档只含概览等基础区块，
  // 是合理的降级；若退回「全部天」会让用户以为导出的是单日版
  // 却看到整趟行程，反而误导。
  const targetDay =
    opts.mode === "day" ? itinerary.find((d) => d.day === opts.day) : undefined;

  const days = opts.mode === "day" ? (targetDay ? [targetDay] : []) : itinerary;

  const header: DocHeader = {
    title: targetDay
      ? `${query.origin} → ${query.destination} 行程方案 · 第 ${targetDay.day} 天`
      : `${query.origin} → ${query.destination} 行程方案`,
    subtitle: targetDay
      ? `${targetDay.date}（第 ${targetDay.day} 天 / 共 ${duration.days} 天）` +
        `${targetDay.theme ? `｜${targetDay.theme}` : ""}｜同行 ${headcount} 人`
      : `${query.departDate} 至 ${query.returnDate}｜${duration.days} 天 ${duration.nights} 晚｜` +
        `成人 ${query.party.adults} 人` +
        (query.party.children > 0 ? `，儿童 ${query.party.children} 人` : "") +
        `｜预算 ${query.budget} 元`,
  };

  const sections: DocSection[] = [];

  // ---------- 概览 ----------
  const overviewParagraphs: string[] = [];

  if (plan.overview) overviewParagraphs.push(plan.overview);

  const overviewFacts: DocFact[] = [
    { label: "同行人数", value: `${headcount} 人` },
    { label: "人均预算", value: `${Math.round(query.budget / Math.max(1, headcount))} 元` },
    { label: "预算档位", value: styleLabel(query.style) },
  ];

  if (query.interests.length > 0) {
    overviewFacts.push({ label: "偏好", value: query.interests.join("、") });
  }

  if (query.notes) {
    overviewParagraphs.push(`补充要求：${query.notes}`);
  }

  sections.push({
    title: "行程概览",
    paragraphs: overviewParagraphs,
    facts: overviewFacts,
  });

  // ---------- 交通与住宿 ----------
  const quoteFacts: DocFact[] = [];

  if (quotes.flight) {
    const f = quotes.flight;

    quoteFacts.push({
      label: "往返交通",
      value:
        `${f.pricePerAdult} 元/人，合计 ${f.totalPrice} 元（${confidenceText(f.confidence)}）` +
        `｜${f.outbound[0]?.from ?? ""} → ${f.outbound[0]?.to ?? ""}`,
    });
  }

  if (quotes.hotel) {
    const h = quotes.hotel;

    quoteFacts.push({
      label: "住宿",
      value:
        `${h.name}，${h.rooms} 间 × ${duration.nights} 晚，` +
        `每晚 ${h.pricePerNight} 元，合计 ${h.totalPrice} 元（${confidenceText(h.confidence)}）`,
    });

    if (h.location) {
      quoteFacts.push({ label: "酒店位置", value: h.location });
    }

    if (h.bookingUrl) {
      quoteFacts.push({ label: "预订链接", value: h.bookingUrl });
    }
  } else if (duration.nights > 0) {
    quoteFacts.push({ label: "住宿", value: "未取得住宿报价" });
  } else {
    quoteFacts.push({ label: "住宿", value: "当日往返，无需住宿" });
  }

  sections.push({ title: "交通与住宿", facts: quoteFacts });

  // ---------- 可选房型 ----------
  // 单日模式跳过：当天再看房型意义不大
  if (opts.mode !== "day" && plan.hotelRooms && plan.hotelRooms.length > 0) {
    sections.push({
      title: "可选房型",
      bullets: plan.hotelRooms.map(describeRoom),
    });
  }

  // ---------- 跨城方式 ----------
  if (opts.mode !== "day" && plan.intercityOptions && plan.intercityOptions.length > 0) {
    sections.push({
      title: "跨城方式对比（单程）",
      table: {
        headers: ["方式", "时刻", "历时", "人均", "说明"],
        rows: plan.intercityOptions.map((o) => [
          o.label,
          o.departTime ? `${o.departTime}-${o.arriveTime}` : "—",
          durationText(o.durationMinutes),
          `${o.perPerson} 元`,
          o.breakdown,
        ]),
      },
    });
  }

  // ---------- 预算分配 ----------
  // 单日模式下预算表意义不大（总额是整趟的），因此只给当天花费
  if (opts.mode === "day") {
    const dayCost = days.reduce((sum, d) => sum + d.estimatedCost, 0);

    sections.push({
      title: "当日预算",
      facts: [
        { label: "当天花费", value: `${dayCost} 元` },
        { label: "人均", value: `${Math.round(dayCost / Math.max(1, headcount))} 元` },
        { label: "整趟总预算", value: `${budget.total} 元` },
      ],
      paragraphs: ["各科目金额由确定性算法计算，详见完整版行程单。"],
    });
  } else {
    sections.push({
      title: "预算分配",
      table: {
        headers: ["科目", "金额（元）", "占比", "说明"],
        rows: budget.categories.map((c) => [
          c.label,
          String(c.amount),
          `${Math.round(c.ratio * 100)}%`,
          c.detail,
        ]),
      },
      facts: [
        { label: "合计", value: `${budget.allocated} 元` },
        { label: "总预算", value: `${budget.total} 元` },
        { label: "人均", value: `${budget.perPerson} 元` },
        { label: "人均每日", value: `${budget.perPersonPerDay} 元` },
      ],
    });
  }

  // ---------- 逐日行程 ----------
  for (const day of days) {
    const paragraphs: string[] = [];

    if (day.theme) paragraphs.push(`主题：${day.theme}`);

    paragraphs.push(`当日花费约 ${day.estimatedCost} 元｜住宿：${day.accommodation || "—"}`);

    // 天气在 plan.weather 上按日期存放，不挂在 day 上
    const weather = plan.weather?.find((w) => w.date === day.date);

    if (weather) {
      // 字段名按实际类型：白天/夜间天气与温度分开，不是单一的 condition/tempMin
      const text = `白天 ${weather.dayWeather} ${weather.dayTemp}｜夜间 ${weather.nightWeather} ${weather.nightTemp}`;
      const wind = [weather.windDirection, weather.windPower].filter(Boolean).join(" ");

      paragraphs.push(`天气：${text}${wind ? `｜${wind}` : ""}`);
    }

    // 通勤方式写进段落而非单独区块：网页上是独立卡片便于对照，
    // 而文档是线性阅读，通勤紧跟当天安排更自然
    const commuteLines = (day.commuteLegs ?? []).map(
      (leg) =>
        `${leg.from} → ${leg.to}：${
          leg.mode === "walk" ? "步行" : leg.mode === "transit" ? "公交/地铁" : "驾车"
        }约 ${leg.durationMinutes} 分钟` +
        (leg.distanceMeters ? `（${(leg.distanceMeters / 1000).toFixed(1)} 公里）` : ""),
    );

    if (commuteLines.length > 0) {
      paragraphs.push(`当日通勤：${commuteLines.join("；")}`);
    }

    // 精简版只列活动名与时间：说明文字动辄几十字，会让文档失去「精简」的意义
    const bullets =
      opts.mode === "compact"
        ? day.activities.map((a) => `${a.startTime}-${a.endTime}  ${a.title}`)
        : day.activities.map((a) => {
            const cost = a.estimatedCost > 0 ? `（约 ${a.estimatedCost} 元）` : "";
            const place = a.address || a.location ? `＠${a.address || a.location}` : "";

            return `${a.startTime}-${a.endTime}  ${a.title}${cost}${place}｜${a.description}`;
          });

    sections.push({
      title: `第 ${day.day} 天（${day.date}）`,
      paragraphs,
      bullets,
      // 带上天数，渲染层据此嵌入当天的路线图
      day: day.day,
    });
  }

  // ---------- 行前准备 ----------
  // 单日模式跳过：行前准备是整趟的事
  if (opts.mode === "full" && plan.checklist.length > 0) {
    sections.push({ title: "行前准备", bullets: plan.checklist });
  }

  // ---------- 提示 ----------
  if (plan.tips.length > 0) {
    sections.push({ title: "出行提示", bullets: plan.tips });
  }

  // ---------- 数据说明 ----------
  const warns = plan.warnings.filter((w) => w.trim().length > 0);

  // 精简版跳过：告警是给核对数据来源用的，转发场景不需要
  if (opts.mode !== "compact" && warns.length > 0) {
    sections.push({
      title: "数据来源与提示",
      bullets: warns,
    });
  }

  const modeNote =
    opts.mode === "day"
      ? `｜单日版（第 ${opts.day} 天）`
      : opts.mode === "compact"
        ? "｜精简版"
        : "";

  const footer =
    `生成时间：${new Date(plan.generatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}｜` +
    `行程编排：${plan.generatedByAI ? `AI（${plan.model ?? "未知模型"}）` : "内置模板"}｜` +
    `金额由确定性算法计算，标注「估算」的价格以实际支付为准${modeNote}`;

  return { header, sections, footer, options: opts };
}

/** 把房型格式化为一句话 */
function describeRoom(room: RoomOption): string {
  const parts = [`${room.averagePrice} 元/晚`, room.roomName];

  if (room.bedType) parts.push(room.bedType);
  if (room.meal) parts.push(room.meal);
  if (room.size) parts.push(`${room.size}㎡`);
  if (room.maxOccupancy) parts.push(`最多 ${room.maxOccupancy} 人`);
  if (room.cancelable) parts.push("可免费取消");
  else if (room.cancelPolicy) parts.push(room.cancelPolicy);

  return parts.join("｜");
}

/** 预算档位的中文名 */
function styleLabel(style: string): string {
  const map: Record<string, string> = {
    budget: "经济型",
    comfort: "舒适型",
    premium: "品质型",
    luxury: "奢享型",
  };

  return map[style] ?? style;
}

/** 文件名（去掉不适合做文件名的字符） */
export function documentFileName(plan: TravelPlan, options: ExportOptions = {}): string {
  const opts = resolveExportOptions(options);

  // 模式后缀让下载多个版本时的文件名可区分
  const suffix =
    opts.mode === "day" && opts.day !== null
      ? `-第${opts.day}天`
      : opts.mode === "compact"
        ? "-精简版"
        : "";

  const raw = `${plan.query.origin}-${plan.query.destination}-行程-${plan.query.departDate}${suffix}`;

  return raw.replace(/[\\/:*?"<>|]/g, "").slice(0, 80) + ".docx";
}
