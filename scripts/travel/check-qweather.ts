/**
 * 和风天气（QWeather）Key 与接口连通性诊断。
 *
 * 用途：高德天气仅覆盖中国且个人额度只有 5000 次/月，出境行程需要全球天气。
 * 和风天气「天气和环境」分组每月前 5 万次请求免费，覆盖全球。
 *
 * 它会依次测三项，对应后续行程里的三类天气信息：
 *   1. GeoAPI 城市查询  把「东京」这类城市名转成 LocationID（后续查询的入口）
 *   2. 逐日天气预报     行程每天用什么天气、温度、风力、降水
 *   3. 天气预警         暴雨/台风等预警，用于触发行程调整建议
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/travel/check-qweather.ts
 *
 * 可选：换测试城市（可测境外城市，这是它相对高德的主要优势）
 *   npx tsx --env-file=.env.local scripts/travel/check-qweather.ts 东京
 */

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * 和风天气 API Host。
 *
 * 重要：这里的默认值只是占位。和风天气已改为「每个用户一个专属 API Host」，
 * 旧版公共 Host（devapi.qweather.com）会返回 403 Invalid Host。
 * 请到控制台【设置】→【API Host】复制你自己的专属地址，写到
 * QWEATHER_HOST 里。未配置时脚本会明确提示这一点，而不是报一句莫名其妙的 403。
 */
const DEFAULT_HOST = "https://devapi.qweather.com";

/**
 * 读取环境变量并去掉引号、空白与 BOM。
 * 与其它诊断脚本保持一致：BOM 会让第一行变量名读不到。
 */
function readEnv(name: string): string | null {
  const raw = process.env[name];

  if (!raw) {
    return null;
  }

  const trimmed = raw.trim().replace(/^\uFEFF/, "").replace(/^["']|["']$/g, "");

  return trimmed.length > 0 ? trimmed : null;
}

/** 找出疑似被 BOM 或空格污染的 QWeather 相关变量名 */
function findPollutedKeys(): string[] {
  return Object.keys(process.env).filter((key) => {
    const upper = key.toUpperCase();

    return upper.includes("QWEATHER") && !/^QWEATHER_(KEY|HOST)$/.test(upper);
  });
}

/** 提取错误根因 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause as { code?: string; message?: string } | undefined;

  if (cause?.code) {
    const hints: Record<string, string> = {
      ENOTFOUND: "域名解析失败，本机无法解析该域名",
      ECONNREFUSED: "连接被拒绝，可能被防火墙拦截",
      ETIMEDOUT: "连接超时",
    };

    return `${hints[cause.code] ?? cause.message ?? error.message}（${cause.code}）`;
  }

  return error.message;
}

/**
 * 带超时的 GET。
 *
 * 用 QWEATHER_HOST 覆盖、并把 Key 放在 X-QW-Api-Key 请求头里，
 * 这样既兼容 2025 年后新用户的专属 Host，也兼容传参写法。
 */
async function getJson(url: string, key: string): Promise<{ payload: Record<string, unknown>; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "X-QW-Api-Key": key },
    });

    const text = await response.text();

    let payload: Record<string, unknown> = {};

    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = { raw: text.slice(0, 200) };
    }

    return { payload, status: response.status };
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
 * 和风天气的状态码 → 人话。
 * 参考 https://dev.qweather.com/docs/resource/status-code/
 */
function explainQWeatherError(code: string): string {
  const known: Record<string, string> = {
    "204": "该地区暂无数据 —— 换个城市或检查 LocationID",
    "400": "请求参数错误 —— 检查 location 参数格式",
    "401": "认证失败 —— Key 不正确，或未放在正确的请求头里",
    "402": "超过访问次数 —— 免费额度用尽（每月前 5 万次免费）",
    "403": "无权限访问 —— 该 Key 未开通此项 API，或账号状态异常",
    "404": "查询的数据或地区不存在",
    "429": "超过 QPS 限制 —— 访问过于频繁，稍后重试",
    "500": "服务端错误 —— 和风天气内部问题，稍后重试",
  };

  return known[code] ? `${code}：${known[code]}` : `${code}：未知状态码，请对照官方文档`;
}

/**
 * 从响应体中提取可读的错误标题与详情。
 *
 * 和风天气新版的错误格式是嵌套对象：
 *   { "error": { "status": 403, "title": "Invalid Host", "type": "...", "detail": "..." } }
 * 而旧版格式是扁平的 { "code": "401" }。两种都要认，否则会把
 * 「Host 配错」误报成「未知状态码」，用户完全无从下手。
 */
function readErrorDetail(payload: Record<string, unknown>, httpStatus: number): string {
  const error = payload.error as
    | { status?: number; title?: string; detail?: string; type?: string }
    | undefined;

  if (error && typeof error === "object") {
    const title = error.title ?? "未知错误";
    const detail = error.detail ?? "";
    const type = error.type ?? "";

    // Host 配错是最常见的坑，单独给一句可执行的指引
    if (type.includes("invalid-host") || title.toLowerCase().includes("invalid host")) {
      return (
        `${title} —— API Host 不正确或未授权。\n` +
        `      和风天气为每个用户分配了专属 API Host，旧的公共地址已不可用。\n` +
        `      请到控制台【设置】→【API Host】复制你的专属地址，填入 .env.local 的 QWEATHER_HOST。`
      );
    }

    return `${title}${detail ? ` —— ${detail}` : ""}`;
  }

  // 旧版扁平格式
  const code = String(payload.code ?? "");

  if (code) {
    return explainQWeatherError(code);
  }

  return `HTTP ${httpStatus}，响应体：${JSON.stringify(payload).slice(0, 200)}`;
}

async function main(): Promise<void> {
  console.log("===== 和风天气 Key 与接口诊断 =====\n");

  // ---------- 1. 环境变量 ----------
  console.log("### 1. 环境变量");

  const key = readEnv("QWEATHER_KEY");
  const host = readEnv("QWEATHER_HOST") ?? DEFAULT_HOST;
  const cityName = process.argv[2] ?? "东京";

  line(key !== null, "QWEATHER_KEY", key ? `已读取（${key.length} 字符）` : "未配置");
  line(true, "API Host", host);
  line(true, "测试城市", cityName);

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
      "\n请先把 Key 填进 .env.local：\n" +
        "  QWEATHER_KEY=你的Key\n" +
        "若控制台给了你专属 API Host，再补一行：\n" +
        "  QWEATHER_HOST=https://你的专属host\n" +
        "然后带上环境文件重新运行：\n" +
        "  npx tsx --env-file=.env.local scripts/travel/check-qweather.ts",
    );
    process.exitCode = 1;

    return;
  }

  // ---------- 2. 城市查询 ----------
  console.log("\n### 2. GeoAPI 城市查询（拿 LocationID，后面两项都要用它）");

  let locationId = "";

  // 经纬度供第 3 步的新版 v1 逐日预报使用
  let lat = 0;
  let lon = 0;

  try {
    const { payload, status } = await getJson(
      `${host}/geo/v2/city/lookup?location=${encodeURIComponent(cityName)}&number=1`,
      key,
    );

    const code = String(payload.code ?? "");

    // 新版返回 { error: {...} }，旧版返回 { code: "403" }；两种都视为失败
    const hasError = Boolean(payload.error) || (code !== "" && code !== "200");

    if (status === 200 && !hasError) {
      const locations = (payload.location ?? []) as Array<Record<string, string>>;

      line(true, "请求成功", `返回 ${locations.length} 条`);

      if (locations.length === 0) {
        line(false, "未返回结果", "换个城市名再试");
        process.exitCode = 1;

        return;
      }

      const first = locations[0];

      locationId = first.id ?? "";
      lat = Number(first.lat ?? 0);
      lon = Number(first.lon ?? 0);

      // 经纬度是第 3 步的必需输入，缺失就没法查天气
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
        line(false, "经纬度缺失", "第 3 步的逐日预报需要经纬度，无法继续");
        process.exitCode = 1;

        return;
      }

      line(
        true,
        `${first.name}`,
        `LocationID ${locationId}｜${first.adm1 ?? ""} ${first.country ?? ""}｜经纬度 ${first.lon},${first.lat}`,
      );
    } else {
      line(false, `请求失败（HTTP ${status}）`, readErrorDetail(payload, status));

      if (!readEnv("QWEATHER_HOST")) {
        console.log(
          "\n    另外：你没有设置 QWEATHER_HOST。和风天气现在要求使用专属 API Host，\n" +
            "    若无专属 Host，这一项几乎一定失败。请到控制台【设置】→【API Host】查看。",
        );
      }

      console.log("\n    Key 或 Host 不可用，后续两项无需再测。");
      process.exitCode = 1;

      return;
    }
  } catch (error) {
    line(false, "城市查询请求异常", describeError(error));
    process.exitCode = 1;

    return;
  }

  if (!locationId) {
    console.log("\n未取得 LocationID，后续天气查询无法进行。");
    process.exitCode = 1;

    return;
  }

  // ---------- 3. 逐日天气预报 ----------
  console.log("\n### 3. 逐日天气预报（行程每天用什么天气）");

  try {
    // 用与主代码**完全一致**的接口与参数，否则诊断通过不代表功能正常。
    // 这里是新版 v1 接口（按经纬度查询），不是旧的 /v7/weather/7d。
    // lang=zh 必填：不加时和风按当地语言返回，东京会得到「晴れ」、
    // 巴黎会得到「Ensoleillé」，与中文页面混排后用户看不懂。
    const url =
      `${host}/weather/v1/daily/${lat.toFixed(2)}/${lon.toFixed(2)}` +
      `?days=7&localTime=true&lang=zh`;

    const { payload, status } = await getJson(url, key);

    const hasError = Boolean(payload.error);

    if (status === 200 && !hasError) {
      const daily = (payload.days ?? []) as Array<Record<string, unknown>>;

      line(true, "请求成功", `返回 ${daily.length} 天预报`);

      for (const day of daily.slice(0, 5)) {
        const daytime = (day.daytime ?? {}) as Record<string, unknown>;
        const nighttime = (day.nighttime ?? {}) as Record<string, unknown>;
        const dayCond = (daytime.condition ?? {}) as Record<string, unknown>;
        const nightCond = (nighttime.condition ?? {}) as Record<string, unknown>;
        const wind = (daytime.wind ?? {}) as Record<string, unknown>;
        const precip = (daytime.precipitation ?? {}) as Record<string, unknown>;
        const amount = (precip.amount ?? {}) as Record<string, unknown>;

        const num = (value: unknown): string => {
          const parsed = Number(value);

          return Number.isFinite(parsed) ? String(Math.round(parsed)) : "-";
        };

        const date = String(day.forecastStartTime ?? "").slice(0, 10);

        console.log(
          `      · ${date}　白天 ${String(dayCond.text ?? "-")}／夜间 ${String(
            nightCond.text ?? "-",
          )}　${num((day.temperatureMin as Record<string, unknown>)?.value)}~${num(
            (day.temperatureMax as Record<string, unknown>)?.value,
          )}℃　风力 ${String(wind.scale ?? "-")} 级　降水 ${String(amount.value ?? "0")}mm`,
        );
      }

      console.log("      提示：天气描述应为中文；若出现日文/法文，说明 lang 参数未生效。");
    } else {
      line(false, `请求失败（HTTP ${status}）`, readErrorDetail(payload, status));
      console.log("      若为权限类错误，说明该 Key 未开通「天气预报」API。");
    }
  } catch (error) {
    line(false, "天气预报请求异常", describeError(error));
  }

  // ---------- 4. 天气预警 ----------
  console.log("\n### 4. 天气预警（暴雨/台风等，用于触发行程调整）");

  try {
    // 预警接口已改版：旧的 /v7/warning/now 返回 403 Deprecated，
    // 新接口按经纬度查询，返回 severity / headline / expireTime 等字段。
    const { payload, status } = await getJson(
      `${host}/weatheralert/v1/current/${lat.toFixed(2)}/${lon.toFixed(2)}?localTime=true&lang=zh`,
      key,
    );

    const hasError = Boolean(payload.error);

    if (status === 200 && !hasError) {
      const alerts = (payload.alerts ?? []) as Array<Record<string, unknown>>;
      const zeroResult = Boolean(
        (payload.metadata as Record<string, unknown> | undefined)?.zeroResult,
      );

      line(
        true,
        "请求成功",
        alerts.length > 0 ? `${alerts.length} 条生效预警` : zeroResult ? "当前无预警" : "当前无预警",
      );

      for (const item of alerts.slice(0, 3)) {
        const eventType = (item.eventType ?? {}) as Record<string, unknown>;
        const color = (item.color ?? {}) as Record<string, unknown>;

        console.log(
          `      · [${String(color.code ?? "-")}] ${String(eventType.name ?? "-")}` +
            ` 严重度 ${String(item.severity ?? "-")}｜${String(item.headline ?? "")}`,
        );
        console.log(`        生效至 ${String(item.expireTime ?? "-")}`);
      }

      console.log(
        "      说明：预警为空属正常（多数时段无预警）。有预警时可在方案里提示用户调整行程。",
      );
    } else {
      line(false, `请求失败（HTTP ${status}）`, readErrorDetail(payload, status));
      console.log("      若为权限类错误，说明该 Key 未开通「预警」API，不影响天气预报功能。");
    }
  } catch (error) {
    line(false, "预警查询请求异常", describeError(error));
  }

  // ---------- 结论 ----------
  console.log("\n===== 诊断结束 =====");
  console.log(
    "第 2、3 步为 ✔ 即可满足行程需求（城市解析 + 逐日预报）。\n" +
      "第 4 步的预警是加分项，即使失败也不影响主功能。",
  );
}

main().catch((error) => {
  console.error("诊断脚本异常：", error);
  process.exitCode = 1;
});

// 标记为模块：避免被 TS 当作全局脚本，声明泄漏导致与其它脚本冲突。
export {};
