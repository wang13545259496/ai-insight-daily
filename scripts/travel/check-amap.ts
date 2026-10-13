/**
 * 高德地图（Amap）Key 与接口连通性诊断。
 *
 * 用途：创建完 Key 后先跑这个，确认「Key 有没有生效、服务平台选对了没有、
 * 配额还能不能用」，再去接主流程。把问题定位在最小范围内，不用靠猜。
 *
 * 它会依次测四项能力，正对应后续旅行规划的四个增强点：
 *   1. 地理编码   把「北京」这类城市名转成 adcode 与经纬度（后续所有查询的基础）
 *   2. POI 搜索   找景点与餐厅（注意：个人认证免费额度仅 5000 次/月，最紧张的一项）
 *   3. 路径规划   算景点之间的真实通勤时间与距离
 *   4. 天气查询   逐日天气预报（仅中国境内，按 adcode 查询）
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/travel/check-amap.ts
 *
 * 可选：换测试城市
 *   npx tsx --env-file=.env.local scripts/travel/check-amap.ts 三亚
 */

const REQUEST_TIMEOUT_MS = 15_000;

/** 高德 Web 服务统一入口 */
const REST_HOST = "https://restapi.amap.com";

/**
 * 读取环境变量并去掉引号、空白与 BOM。
 *
 * 为什么处理 BOM：用记事本或 PowerShell 写出的 .env 文件可能带 \uFEFF，
 * 会让第一行的变量名读不到，表现为「明明填了却说未配置」。
 */
function readEnv(name: string): string | null {
  const raw = process.env[name];

  if (!raw) {
    return null;
  }

  const trimmed = raw.trim().replace(/^\uFEFF/, "").replace(/^["']|["']$/g, "");

  return trimmed.length > 0 ? trimmed : null;
}

/** 找出疑似被 BOM 或空格污染的 Amap 相关变量名 */
function findPollutedKeys(): string[] {
  return Object.keys(process.env).filter((key) => {
    const upper = key.toUpperCase();

    return upper.includes("AMAP") && !/^AMAP_(WEB_KEY|KEY|JS_KEY)$/.test(upper);
  });
}

/** 提取错误根因（Node 的 fetch 会把真正原因藏在 error.cause 里） */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause as { code?: string; message?: string } | undefined;

  if (cause?.code) {
    const hints: Record<string, string> = {
      ENOTFOUND: "域名解析失败，本机无法解析高德域名",
      EAI_AGAIN: "DNS 暂时不可用",
      ECONNREFUSED: "连接被拒绝，可能被防火墙拦截",
      ECONNRESET: "连接被重置",
      ETIMEDOUT: "连接超时",
    };

    return `${hints[cause.code] ?? cause.message ?? error.message}（${cause.code}）`;
  }

  return error.message;
}

/** 带超时的 GET，返回解析后的 JSON */
async function getJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });

    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

/** 打印一行结论 */
function line(ok: boolean | null, label: string, detail = ""): void {
  const mark = ok === null ? "•" : ok ? "✔" : "✘";

  console.log(`  ${mark} ${label}${detail ? `：${detail}` : ""}`);
}

/**
 * 高德的错误码 → 人话。
 * 参考 https://lbs.amap.com/api/webservice/guide/tools/info
 */
function explainAmapError(info: string, infocode: string): string {
  const known: Record<string, string> = {
    "10001": "Key 不正确或已过期 —— 请核对是否复制完整",
    "10002": "Key 被禁用 —— 检查控制台里该 Key 是否被停用或删除",
    "10003": "日调用量已超限 —— 免费配额用完了",
    "10004": "访问过于频繁 —— 触发 QPS 限制，稍后重试",
    "10005": "IP 白名单限制 —— 该 Key 设置了 IP 白名单，本机 IP 不在其中",
    "10006": "账号维度调用量超限",
    "10007": "账号维度 QPS 超限",
    "10008": "账号余额不足",
    "10009": "Key 与绑定的平台不匹配 —— 很可能服务平台选错了",
    "10012": "权限不足 —— 该 Key 未开通此服务",
    "10013": "Key 未绑定服务 —— 创建 Key 时没有勾选对应服务",
    "10019": "请求 Key 与绑定平台不符 —— 请确认服务平台选的是「Web 服务」",
    "10020": "该项目未开通此服务",
    "10021": "该服务已过期",
    "20000": "请求参数错误",
    "20001": "缺少必填参数",
    "20003": "参数格式错误",
    "20800": "规划点不在中国境内 —— 境外目的地无数据",
    "20802": "无法规划 —— 起终点过近或过远，或不在支持范围内",
  };

  const code = String(infocode);

  return known[code] ? `${info}（${code}：${known[code]}）` : `${info}（infocode ${code}）`;
}

/** 判断高德响应是否为成功 */
function isAmapOk(payload: Record<string, unknown>): boolean {
  return payload.status === "1";
}

async function main(): Promise<void> {
  console.log("===== 高德地图 Key 与接口诊断 =====\n");

  // ---------- 1. 环境变量 ----------
  console.log("### 1. 环境变量");

  const key = readEnv("AMAP_WEB_KEY") ?? readEnv("AMAP_KEY");
  const cityName = process.argv[2] ?? "北京";

  line(key !== null, "AMAP_WEB_KEY", key ? `已读取（${key.length} 字符）` : "未配置");

  const polluted = findPollutedKeys();

  if (polluted.length > 0) {
    console.log("\n  ⚠ 检测到异常变量名，通常是 .env.local 带了 BOM 或多余空格：");

    for (const item of polluted) {
      console.log(`      ${JSON.stringify(item)}`);
    }

    console.log(
      "    处理办法：用 VS Code 打开 .env.local，右下角编码选「UTF-8」（不要选 with BOM）后保存。",
    );
  }

  if (!key) {
    console.log(
      "\n请先把 Key 填进 .env.local，变量名建议用 AMAP_WEB_KEY：\n" +
        "  AMAP_WEB_KEY=你的Key\n" +
        "然后带上环境文件重新运行：\n" +
        "  npx tsx --env-file=.env.local scripts/travel/check-amap.ts",
    );
    process.exitCode = 1;

    return;
  }

  // ---------- 2. 地理编码 ----------
  console.log(`\n### 2. 地理编码（把「${cityName}」转成 adcode 与经纬度）`);

  let adcode = "";
  let center = "";

  try {
    const payload = await getJson(
      `${REST_HOST}/v3/geocode/geo?key=${encodeURIComponent(key)}&address=${encodeURIComponent(cityName)}`,
    );

    if (!isAmapOk(payload)) {
      line(false, `GET /v3/geocode/geo → 失败`, explainAmapError(String(payload.info), String(payload.infocode)));
      console.log(
        "\n    Key 不可用，后续三项无需再测。若提示「平台不匹配」或「未绑定服务」，\n" +
          "    请回控制台确认：该 Key 的服务平台是否为【Web 服务】。",
      );
      process.exitCode = 1;

      return;
    }

    const geocodes = (payload.geocodes ?? []) as Array<Record<string, string>>;

    line(true, "请求成功", `返回 ${geocodes.length} 条`);

    if (geocodes.length > 0) {
      adcode = geocodes[0].adcode ?? "";
      center = geocodes[0].location ?? "";

      line(true, `${cityName}`, `adcode ${adcode}，经纬度 ${center}`);
    } else {
      line(false, "未返回结果", "换个城市名再试（建议用「北京市」这类规范名称）");
    }
  } catch (error) {
    line(false, "地理编码请求异常", describeError(error));
    process.exitCode = 1;

    return;
  }

  const [lng, lat] = center.split(",");

  // ---------- 3. POI 搜索 ----------
  console.log("\n### 3. POI 搜索（找景点与餐厅，配额最紧张的一项）");

  try {
    const payload = await getJson(
      `${REST_HOST}/v3/place/text?key=${encodeURIComponent(key)}` +
        `&keywords=${encodeURIComponent("景点")}&city=${encodeURIComponent(cityName)}` +
        `&citylimit=true&offset=5&page=1&extensions=base`,
    );

    if (isAmapOk(payload)) {
      const pois = (payload.pois ?? []) as Array<Record<string, string>>;

      line(true, "请求成功", `返回 ${pois.length} 个 POI`);

      for (const poi of pois.slice(0, 5)) {
        console.log(`      · ${poi.name}｜${poi.address || "无地址"}｜${poi.location}`);
      }

      if (pois.length === 0) {
        console.log("      该城市暂无结果，换个大城市再试（境外城市通常无数据）");
      }
    } else {
      line(false, "请求失败", explainAmapError(String(payload.info), String(payload.infocode)));
      console.log(
        "      常见原因：该 Key 未勾选「搜索服务」，或服务平台不是 Web 服务。\n" +
          "      注意：POI 搜索个人认证免费额度约 5000 次/月，用超会返回 10003。",
      );
    }
  } catch (error) {
    line(false, "POI 搜索请求异常", describeError(error));
  }

  // ---------- 4. 路径规划 ----------
  console.log("\n### 4. 公交路径规划（算景点之间的真实通勤）");

  if (!lng || !lat) {
    line(null, "跳过", "缺少经纬度，无法构造起终点");
  } else {
    // 用同一城市内微调坐标构造一次短途公交查询，验证接口权限
    const origin = `${lng},${lat}`;
    const destination = `${Number(lng) + 0.02},${Number(lat) + 0.02}`;

    try {
      const payload = await getJson(
        `${REST_HOST}/v3/direction/transit/integrated?key=${encodeURIComponent(key)}` +
          `&origin=${origin}&destination=${destination}` +
          `&city=${encodeURIComponent(cityName)}&cityd=${encodeURIComponent(cityName)}`,
      );

      if (isAmapOk(payload)) {
        const route = payload.route as Record<string, unknown> | undefined;
        const transits = (route?.transits ?? []) as Array<Record<string, string>>;

        line(true, "请求成功", `返回 ${transits.length} 条公交方案`);

        if (transits.length > 0) {
          const first = transits[0];
          const minutes = Math.round(Number(first.duration ?? 0) / 60);

          line(true, "示例方案", `约 ${minutes} 分钟，距离 ${first.distance} 米`);
        }
      } else {
        line(false, "请求失败", explainAmapError(String(payload.info), String(payload.infocode)));
        console.log(
          "      常见原因：该 Key 未勾选「路径规划」服务。\n" +
            "      注意：公交路径规划必须同时传起终点城市；境外无数据（会返回 20800）。",
        );
      }
    } catch (error) {
      line(false, "路径规划请求异常", describeError(error));
    }
  }

  // ---------- 5. 天气查询 ----------
  console.log("\n### 5. 天气查询（仅中国境内，按 adcode 查询）");

  if (!adcode) {
    line(null, "跳过", "缺少 adcode");
  } else {
    try {
      const payload = await getJson(
        `${REST_HOST}/v3/weather/weatherInfo?key=${encodeURIComponent(key)}&city=${adcode}&extensions=all`,
      );

      if (isAmapOk(payload)) {
        const forecasts = (payload.forecasts ?? []) as Array<Record<string, unknown>>;

        line(true, "请求成功", `返回 ${forecasts.length} 个城市的预报`);

        if (forecasts.length > 0) {
          const casts = (forecasts[0].casts ?? []) as Array<Record<string, string>>;

          for (const cast of casts.slice(0, 3)) {
            console.log(
              `      · ${cast.date} ${cast.dayweather}｜${cast.nighttemp}~${cast.daytemp}℃｜${cast.daywind}风 ${cast.daypower}级`,
            );
          }
        }

        console.log(
          "      提醒：高德天气仅覆盖中国，且个人认证额度约 5000 次/月；\n" +
            "      出境行程建议改用和风天气（5 万次/月，全球覆盖）。",
        );
      } else {
        line(false, "请求失败", explainAmapError(String(payload.info), String(payload.infocode)));
      }
    } catch (error) {
      line(false, "天气查询请求异常", describeError(error));
    }
  }

  // ---------- 结论 ----------
  console.log("\n===== 诊断结束 =====");
  console.log(
    "四项全 ✔ 说明 Key 配置正确，可以接进主流程。\n" +
      "若第 2 步就失败，问题一定在 Key 本身（复制不全、服务平台选错、未实名认证）；\n" +
      "若第 2 步成功而第 3/4/5 步失败，是创建 Key 时没勾选对应服务，回控制台编辑 Key 补勾即可。",
  );
}

main().catch((error) => {
  console.error("诊断脚本异常：", error);
  process.exitCode = 1;
});

// 标记为模块：否则 TS 会把本文件当成全局脚本，声明会泄漏到全局作用域，
// 与其它脚本的同名声明冲突（TS2393）。
export {};
