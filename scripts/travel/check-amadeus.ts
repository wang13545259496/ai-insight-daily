/**
 * Amadeus 凭据与接口连通性诊断。
 *
 * 用途：填完 .env.local 后先跑这个，确认「Key 有没有生效、能不能真的拿到报价」，
 * 再去页面上生成方案。把问题定位在最小范围内，不用靠猜。
 *
 * 它会依次做四件事：
 *   1. 检查环境变量是否读到（区分「没填」和「填错」）
 *   2. 用凭据换 access token（验证 Key/Secret 是否正确）
 *   3. 查一条真实航线（验证 Flight Offers 权限与配额）
 *   4. 查一个目的地城市的酒店（验证 Hotel 权限；该接口覆盖度有限，拿不到房价属正常）
 *
 * 每一步都会打印 HTTP 状态码与原始返回片段，便于对照 Amadeus 的错误码。
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/travel/check-amadeus.ts
 *
 * 可选：换测试航线
 *   npx tsx --env-file=.env.local scripts/travel/check-amadeus.ts BJS TYO 2026-12-10 2026-12-14
 */

const REQUEST_TIMEOUT_MS = 15_000;

/** 默认测试参数：北京 → 东京，未来一个月内的日期 */
function defaultDates(): { depart: string; ret: string } {
  const base = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  return {
    depart: base,
    ret: new Date(Date.parse(`${base}T00:00:00Z`) + 4 * 86_400_000).toISOString().slice(0, 10),
  };
}

const argv = process.argv.slice(2);
const origin = (argv[0] ?? "BJS").toUpperCase();
const destination = (argv[1] ?? "TYO").toUpperCase();
const fallbackDates = defaultDates();
const departDate = argv[2] ?? fallbackDates.depart;
const returnDate = argv[3] ?? fallbackDates.ret;

/**
 * 读取环境变量并去掉可能的引号、空白与 BOM。
 *
 * 为什么要处理 BOM：用记事本「另存为 UTF-8」或 PowerShell 的
 * Set-Content -Encoding utf8 写出的 .env 文件会在开头带 \uFEFF，
 * 于是第一行的变量名变成 "\uFEFFAMADEUS_CLIENT_ID"，Node 读不到，
 * 表现为「明明填了却说未配置」。这里做容错，并在下面主动提示。
 */
function readEnv(name: string): string | null {
  const raw = process.env[name];

  if (!raw) {
    return null;
  }

  const trimmed = raw.trim().replace(/^\uFEFF/, "").replace(/^["']|["']$/g, "");

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 找出环境变量中疑似被 BOM 或空格污染的键名。
 * 只关心与 Amadeus 相关、但不符合标准写法的键。
 */
function findPollutedKeys(): string[] {
  return Object.keys(process.env).filter((key) => {
    const upper = key.toUpperCase();

    return (
      upper.includes("AMADEUS") &&
      !/^AMADEUS_(CLIENT_ID|CLIENT_SECRET|ENV|BASE_URL)$/.test(upper)
    );
  });
}

/**
 * 提取错误的根因描述。
 *
 * Node 的 fetch 在连接层失败时只报 "fetch failed"，真正的原因
 * （ENOTFOUND / ECONNREFUSED / 超时）在 error.cause 里。这里把它挖出来，
 * 否则用户看到「fetch failed」完全无从下手。
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause as { code?: string; message?: string } | undefined;

  if (cause?.code) {
    const hints: Record<string, string> = {
      ENOTFOUND: "域名解析失败，本机无法解析 Amadeus 域名",
      EAI_AGAIN: "DNS 暂时不可用",
      ECONNREFUSED: "连接被拒绝，可能被防火墙或代理拦截",
      ECONNRESET: "连接被重置，可能被网络中间设备中断",
      ETIMEDOUT: "连接超时",
      UND_ERR_CONNECT_TIMEOUT: "连接超时",
    };

    return `${hints[cause.code] ?? cause.message ?? error.message}（${cause.code}）`;
  }

  return error.message;
}

/** 带超时的 fetch */
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** 打印一行结论 */
function line(ok: boolean | null, label: string, detail = ""): void {
  const mark = ok === null ? "•" : ok ? "✔" : "✘";

  console.log(`  ${mark} ${label}${detail ? `：${detail}` : ""}`);
}

/** 截断长文本，保留可读片段 */
function clip(text: string, length = 400): string {
  const compact = text.replace(/\s+/g, " ").trim();

  return compact.length > length ? `${compact.slice(0, length)}…` : compact;
}

async function main(): Promise<void> {
  console.log("===== Amadeus 凭据与接口诊断 =====\n");

  // ---------- 1. 环境变量 ----------
  console.log("### 1. 环境变量");

  const clientId = readEnv("AMADEUS_CLIENT_ID");
  const clientSecret = readEnv("AMADEUS_CLIENT_SECRET");
  const envName = (readEnv("AMADEUS_ENV") ?? "test").toLowerCase();
  const baseUrlOverride = readEnv("AMADEUS_BASE_URL");

  const isProduction = envName === "production";

  const host =
    baseUrlOverride ?? (isProduction ? "https://api.amadeus.com" : "https://test.api.amadeus.com");

  line(clientId !== null, "AMADEUS_CLIENT_ID", clientId ? `已读取（${clientId.length} 字符）` : "未配置");
  line(
    clientSecret !== null,
    "AMADEUS_CLIENT_SECRET",
    clientSecret ? `已读取（${clientSecret.length} 字符）` : "未配置",
  );
  line(
    true,
    "AMADEUS_ENV",
    `${envName}${isProduction ? "（生产：返回可用于报价的数据）" : "（测试：价格为示例数据）"}`,
  );
  line(true, "接口地址", host);

  // 主动提示被 BOM 或空格污染的键名：这是最常见、也最难自查的坑
  const polluted = findPollutedKeys();

  if (polluted.length > 0) {
    console.log("\n  ⚠ 检测到异常变量名，这通常意味着 .env.local 带了 BOM 或多余空格：");

    for (const key of polluted) {
      console.log(`      ${JSON.stringify(key)}`);
    }

    console.log(
      "    处理办法：用 VS Code 打开 .env.local，右下角编码选「UTF-8」（不要选「UTF-8 with BOM）」后保存；\n" +
        "    或删除首行的隐藏字符后重新保存。",
    );
  }

  if (!clientId || !clientSecret) {
    console.log(
      "\n请先把 Key 填进 .env.local（参考 .env.example 中的 AMADEUS 段落），再重新运行本脚本。",
    );
    console.log("注意：npx tsx 不会自动读取 .env.local，必须带 --env-file=.env.local 参数。");
    process.exitCode = 1;

    return;
  }

  // ---------- 2. 换取 token ----------
  console.log("\n### 2. 换取 access token（验证 Key 与 Secret）");

  const tokenBody = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  let token: string | null = null;

  try {
    const response = await request(`${host}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    const text = await response.text();

    line(response.ok, `POST /v1/security/oauth2/token → HTTP ${response.status}`);

    if (response.ok) {
      const payload = JSON.parse(text) as { access_token?: string; expires_in?: number };

      token = payload.access_token ?? null;

      line(
        token !== null,
        "access_token",
        token ? `已获取（有效期 ${payload.expires_in ?? "?"} 秒）` : "响应中没有 access_token",
      );
    } else {
      console.log(`    原始返回：${clip(text)}`);
      console.log(
        "\n    常见原因：\n" +
          "    · 401 invalid_client：Client ID / Secret 复制错误，或末尾多了空格\n" +
          "    · 复制到了文档示例值：必须用你自己创建的应用的 Key，不能照抄文档里的占位值\n" +
          "    · 应用被删除或 Secret 被重置过：回 Amadeus 后台重新复制",
      );
    }
  } catch (error) {
    line(false, "鉴权请求异常", describeError(error));
    console.log(
      "\n    这是网络层失败，不是 Key 的问题。若提示域名解析失败或连接超时，\n" +
        "    说明本机到 Amadeus 的网络不通（常见于公司网络或代理环境），\n" +
        "    可先确认浏览器能否打开 https://test.api.amadeus.com ，再考虑配置代理。",
    );
  }

  if (!token) {
    console.log("\n鉴权未通过，后续接口无法测试。请先解决上面的问题。");
    process.exitCode = 1;

    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ---------- 3. 机票询价 ----------
  console.log("\n### 3. 机票询价（验证 Flight Offers Search 权限）");
  console.log(
    `  查询：${origin} → ${destination}，${departDate} 去 / ${returnDate} 返，1 成人，币种 CNY`,
  );

  const flightParams = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: departDate,
    returnDate: returnDate,
    adults: "1",
    travelClass: "ECONOMY",
    currencyCode: "CNY",
    max: "5",
  });

  try {
    const response = await request(`${host}/v1/shopping/flight-offers?${flightParams.toString()}`, {
      headers: authHeaders,
    });

    const text = await response.text();

    line(response.ok, `GET /v1/shopping/flight-offers → HTTP ${response.status}`);

    if (response.ok) {
      const payload = JSON.parse(text) as {
        data?: Array<{
          price?: { grandTotal?: string; total?: string; currency?: string };
          itineraries?: Array<{ segments?: unknown[] }>;
        }>;
      };

      const offers = payload.data ?? [];

      line(offers.length > 0, "返回报价数量", `${offers.length} 条`);

      if (offers.length > 0) {
        const best = offers
          .map((offer) => ({
            offer,
            price: Number(offer.price?.grandTotal ?? offer.price?.total ?? NaN),
          }))
          .filter((item) => Number.isFinite(item.price))
          .sort((a, b) => a.price - b.price)[0];

        if (best) {
          const segments = best.offer.itineraries?.[0]?.segments?.length ?? 0;

          line(
            true,
            "最低价",
            `${best.price} ${best.offer.price?.currency ?? ""}（去程 ${segments} 个航段）`,
          );
        } else {
          line(false, "价格字段", "报价中没有 grandTotal/total 字段");
        }
      } else {
        console.log(
          "    该航线暂无数据。测试环境只覆盖部分航线的示例数据，\n" +
            "    换热门大城市再试（官方建议用 LON、NYC 这类大城市），例如：\n" +
            "      npx tsx --env-file=.env.local scripts/travel/check-amadeus.ts BJS BKK",
        );
      }
    } else {
      console.log(`    原始返回：${clip(text)}`);
      console.log(
        "\n    常见原因：\n" +
          "    · 401：token 未被接受（本脚本已自动带上；若仍 401 多为应用权限问题）\n" +
          "    · 403 / 429：该应用未开通此 API，或已超出免费配额\n" +
          "    · 400 INVALID DATE：日期须为 YYYY-MM-DD，且不能是过去的日期\n" +
          "    · 400：同行人数超过 9 人（接口硬限制）",
      );
    }
  } catch (error) {
    line(false, "机票询价异常", describeError(error));
  }

  // ---------- 4. 酒店询价 ----------
  console.log("\n### 4. 住宿询价（验证 Hotel Search 权限与覆盖度）");
  console.log(`  查询：${destination}，${departDate} 入住 / ${returnDate} 退房，1 间`);

  const hotelParams = new URLSearchParams({
    cityCode: destination,
    checkInDate: departDate,
    checkOutDate: returnDate,
    adults: "1",
    roomQuantity: "1",
    currency: "CNY",
    bestRateOnly: "true",
  });

  try {
    const response = await request(`${host}/v3/shopping/hotel-offers?${hotelParams.toString()}`, {
      headers: authHeaders,
    });

    const text = await response.text();

    line(response.ok, `GET /v3/shopping/hotel-offers → HTTP ${response.status}`);

    if (response.ok) {
      const payload = JSON.parse(text) as {
        data?: Array<{
          hotel?: { name?: string };
          offers?: Array<{ price?: { total?: string; currency?: string } }>;
        }>;
      };

      const hotels = payload.data ?? [];

      const withPrice = hotels.filter((item) => {
        const raw = Number(item.offers?.[0]?.price?.total ?? NaN);

        return Number.isFinite(raw) && raw > 0;
      });

      line(hotels.length > 0, "返回酒店数量", `${hotels.length} 家`);
      line(withPrice.length > 0, "其中含房价", `${withPrice.length} 家`);

      if (withPrice.length > 0) {
        const best = withPrice
          .map((item) => ({
            name: item.hotel?.name ?? "未知",
            price: Number(item.offers?.[0]?.price?.total),
            currency: item.offers?.[0]?.price?.currency ?? "",
          }))
          .sort((a, b) => a.price - b.price)[0];

        line(true, "最低房价", `${best.name}｜${best.price} ${best.currency}（整个入住期间）`);
      } else {
        console.log(
          "    这是预期内的正常情况：Amadeus 酒店接口在部分城市只返回酒店清单、不返回房价。\n" +
            "    系统会把住宿降级为估算值，并在页面告警里明确说明，不会伪造房价。",
        );
      }
    } else {
      console.log(`    原始返回：${clip(text)}`);
      console.log(
        "\n    常见原因：\n" +
          "    · 403：该应用未开通 Hotel Search（免费应用默认可能不含此 API）\n" +
          "    · 400：城市码不被酒店接口接受，可换成机场三字码再试",
      );
    }
  } catch (error) {
    line(false, "住宿询价异常", describeError(error));
  }

  // ---------- 结论 ----------
  console.log("\n===== 诊断结束 =====");
  console.log(
    "若第 2、3 步为 ✔，说明凭据与机票接口已通，回到 /travel 页面生成的方案会把交通标注为「实时报价」；\n" +
      "第 4 步即使为 ✘，住宿走估算也不影响功能可用。",
  );
}

main().catch((error) => {
  console.error("诊断脚本异常：", error);
  process.exitCode = 1;
});

// 标记为模块：否则 TS 会把本文件当成全局脚本，其中的 origin、describeError
// 等声明会泄漏到全局作用域，与其它脚本的同名声明冲突（TS2451 / TS2393）。
export {};
