/**
 * 火车站枢纽度评分。
 *
 * 解决什么问题：飞常准返回某条线路的全部车次，其中不少从郊区小站发车。
 * 实测「上海→杭州」返回的最便宜方案是「上海松江→杭州」（¥23.5），
 * 以及「金山北→临平南」—— 这些站在远郊，用户实际出行预期的是
 * 虹桥、杭州东这类枢纽站。只按价格排序会把它们推到最前面。
 *
 * 做法：给车站打「枢纽度」分（0-100），越主要的站分越高。
 * 排序时把枢纽度作为首要因子，价格与耗时作为次要因子。
 *
 * 数据来源：车站清单是人工整理的国内主要铁路枢纽，
 * 依据是各城市的实际枢纽站布局（高铁主站 + 普速主站）。
 * 之所以不用接口自动识别：高德 POI 的「火车站」分类不区分
 * 枢纽与乘降所，而按车次密度反推会引入额外请求与不确定性。
 * 这份清单是纯静态数据，可解释、可测试、零成本。
 */

/**
 * 各城市的主要车站（枢纽站）。
 *
 * 键为城市名（与飞常准接口用的中文城市名一致）。
 * 数组顺序不代表优先级，优先级由下面的层级规则决定。
 */
export const MAJOR_STATIONS: Record<string, string[]> = {
  北京: ["北京南", "北京", "北京西", "北京丰台", "北京北", "北京朝阳", "清河"],
  上海: ["上海虹桥", "上海", "上海南"],
  广州: ["广州南", "广州", "广州东", "广州北"],
  深圳: ["深圳北", "深圳", "深圳东", "福田"],
  杭州: ["杭州东", "杭州", "杭州西", "杭州南"],
  南京: ["南京南", "南京"],
  成都: ["成都东", "成都", "成都南"],
  重庆: ["重庆北", "重庆西", "重庆", "沙坪坝"],
  武汉: ["武汉", "汉口", "武昌"],
  西安: ["西安北", "西安"],
  长沙: ["长沙南", "长沙"],
  郑州: ["郑州东", "郑州"],
  天津: ["天津", "天津西", "天津南", "滨海"],
  济南: ["济南西", "济南", "济南东"],
  青岛: ["青岛", "青岛北"],
  合肥: ["合肥南", "合肥"],
  福州: ["福州", "福州南"],
  厦门: ["厦门北", "厦门"],
  南昌: ["南昌西", "南昌"],
  昆明: ["昆明南", "昆明"],
  贵阳: ["贵阳北", "贵阳"],
  南宁: ["南宁东", "南宁"],
  海口: ["海口东", "海口"],
  三亚: ["三亚"],
  沈阳: ["沈阳北", "沈阳", "沈阳南"],
  大连: ["大连北", "大连"],
  哈尔滨: ["哈尔滨西", "哈尔滨", "哈尔滨东"],
  长春: ["长春", "长春西"],
  石家庄: ["石家庄", "石家庄北"],
  太原: ["太原南", "太原"],
  呼和浩特: ["呼和浩特东", "呼和浩特"],
  兰州: ["兰州西", "兰州"],
  西宁: ["西宁"],
  银川: ["银川"],
  乌鲁木齐: ["乌鲁木齐"],
  拉萨: ["拉萨"],
  苏州: ["苏州", "苏州北"],
  无锡: ["无锡", "无锡东"],
  宁波: ["宁波"],
  温州: ["温州南", "温州"],
  徐州: ["徐州东", "徐州"],
  常州: ["常州", "常州北"],
  南通: ["南通", "南通西"],
  扬州: ["扬州", "扬州东"],
  洛阳: ["洛阳龙门", "洛阳"],
  桂林: ["桂林北", "桂林"],
  丽江: ["丽江"],
  大理: ["大理"],
  张家界: ["张家界西", "张家界"],
};

/**
 * 「东/南/西/北」后缀的方位站，通常是高铁主站。
 * 当某城市不在上面的清单里时，用这条规则兜底。
 */
const DIRECTIONAL_SUFFIX = /[东南西北]$/;

/**
 * 明显是郊区/远郊乘降所的特征词。
 *
 * 这些站名通常带区县名，但高铁主站也可能带区县名
 * （如「上海虹桥」的虹桥是片区、「北京丰台」的丰台是市辖区），
 * 因此只在「不在主要清单里」时才据此降权。
 */
const SUBURBAN_HINTS = [
  "松江",
  "金山",
  "嘉定",
  "青浦",
  "奉贤",
  "崇明",
  "临平",
  "余杭",
  "富阳",
  "桐庐",
  "蓟州",
  "武清",
  "宝坻",
  "静海",
  "宁河",
  "亦庄",
  "黄村",
  "通州",
  "顺义",
  "昌平",
];

/** 评分常量 */
export const STATION_SCORE = {
  /** 在城市主要车站清单里 */
  major: 100,
  /** 不在清单里但带东南西北方位后缀（多为高铁站） */
  directional: 70,
  /** 不在清单里、名字含明显郊区特征词 */
  suburban: 20,
  /** 其余（无法判断） */
  unknown: 50,
};

/** 判断车站是否属于某城市 */
function belongsToCity(station: string, city: string): boolean {
  if (!station || !city) return false;

  // 「上海虹桥」以「上海」开头；「北京南」以「北京」开头
  if (station.startsWith(city)) return true;

  // 少数站名不含城市名（如「清河」属北京），靠主要车站清单命中
  const majors = MAJOR_STATIONS[city];

  return Array.isArray(majors) && majors.includes(station);
}

/**
 * 给车站打枢纽度分（0-100，越高越主要）。
 *
 * @param station 站名，如「上海虹桥」
 * @param city    所属城市，如「上海」
 */
export function stationScore(station: string, city: string): number {
  const name = String(station || "").trim();

  if (!name) return 0;

  // 1. 命中该城市的主要车站清单 → 最高分
  const majors = MAJOR_STATIONS[city];

  if (Array.isArray(majors) && majors.includes(name)) {
    return STATION_SCORE.major;
  }

  // 2. 名字含明显郊区特征词 → 最低分
  //
  // 顺序很关键：先判郊区再判方位后缀。
  // 因为「上海松江东」这类名字既含郊区词又带方位后缀，
  // 若先判后缀会被误判为高铁主站。
  if (SUBURBAN_HINTS.some((h) => name.includes(h))) {
    return STATION_SCORE.suburban;
  }

  // 3. 带方位后缀（东/南/西/北）→ 多为高铁主站
  //
  // 这一步不校验城市归属：站名常省略城市名（如「亦庄」「清河」），
  // 而方位后缀本身就是高铁站的强特征，无需城市信息辅助判断。
  if (DIRECTIONAL_SUFFIX.test(name)) {
    return STATION_SCORE.directional;
  }

  // 4. 属于该城市但无方位后缀（如「苏州」）→ 默认分
  if (belongsToCity(name, city)) {
    return STATION_SCORE.unknown;
  }

  // 5. 不属于该城市（可能是邻近城市的站）→ 默认分
  return STATION_SCORE.unknown;
}

/**
 * 计算一趟车次的整体优先级分（越高越该推荐）。
 *
 * 权重设计（用实测数据校准）：
 *   枢纽度 0-100 分 × 10  = 0-1000  首要因子
 *   高铁/动车加成 150              次之（G/D 车次的体验明显更好）
 *   价格惩罚 -价格 × 0.3           再次（避免最贵的高铁霸榜）
 *   耗时惩罚 -分钟 × 0.3           最后（同价位选快的）
 *
 * 校准依据（上海→杭州实测）：
 *   松江→杭州   硬座 ¥23.5  116 分  → 枢纽度 20  → 20×10 + 0 - 7 - 35 = 158
 *   虹桥→杭州东 二等 ¥73    45 分   → 枢纽度 100 → 100×10 + 150 - 22 - 14 = 1114
 *   高铁方案以明显优势胜出，符合「多花 50 元换少跑 30 公里」的实际取舍。
 *
 * 若把价格权重调高（如 ×1.0），松江方案会反超 —— 但那正是要修的问题。
 */
export function trainPriorityScore(params: {
  fromStation: string;
  toStation: string;
  trainNumber: string;
  price: number;
  durationMinutes: number;
  originCity: string;
  destinationCity: string;
}): number {
  const fromScore = stationScore(params.fromStation, params.originCity);
  const toScore = stationScore(params.toStation, params.destinationCity);

  // 两端取平均：一端是枢纽、另一端是郊区，整体仍不理想
  const hubScore = (fromScore + toScore) / 2;

  const isHighSpeed = /^[GD]/.test(params.trainNumber);
  const highSpeedBonus = isHighSpeed ? HIGH_SPEED_BONUS : 0;

  const pricePenalty = Math.max(0, params.price) * PRICE_PENALTY_FACTOR;
  const durationPenalty = Math.max(0, params.durationMinutes) * DURATION_PENALTY_FACTOR;

  return hubScore * HUB_WEIGHT + highSpeedBonus - pricePenalty - durationPenalty;
}

/** 枢纽度权重 */
const HUB_WEIGHT = 10;
/** 高铁/动车加成 */
const HIGH_SPEED_BONUS = 150;
/** 每元价格扣分 */
const PRICE_PENALTY_FACTOR = 0.3;
/** 每分钟耗时扣分 */
const DURATION_PENALTY_FACTOR = 0.3;

/**
 * 判断某趟车是否从「双方都是枢纽站」出发/到达。
 * 供界面标注使用。
 */
export function isMajorRoute(
  fromStation: string,
  toStation: string,
  originCity: string,
  destinationCity: string,
): boolean {
  return (
    stationScore(fromStation, originCity) >= STATION_SCORE.major &&
    stationScore(toStation, destinationCity) >= STATION_SCORE.major
  );
}
