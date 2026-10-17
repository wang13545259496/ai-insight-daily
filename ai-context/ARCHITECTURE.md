# AI Insight Daily 技术架构

> 版本：V2.0（2026-10-16 核实重写）
> V1.0 内容过简（全文约 360 字符），且部署链路遗漏了 Cloudflare 隧道。

---

## 一、技术栈

| 层 | 技术 | 版本 |
| --- | --- | --- |
| 框架 | Next.js（App Router） | 16.3.5 |
| UI | React | 19.2.8 |
| 语言 | TypeScript | 5.9 |
| 样式 | Tailwind CSS | 4.x |
| ORM | Prisma Client | 6.19.3 |
| 数据库 | SQLite（`prisma/dev.db`） | — |
| 运行时 | Node.js | v22.23.3 |
| 进程管理 | PM2 | 7.0.4 |

### Next.js 16 的两个重要差异

1. **`middleware` 已更名为 `proxy`** —— 文件名与导出名都要用 `proxy`，
   旧写法会失效。项目根目录的 `proxy.ts` 承担两类拦截：
   生产环境禁用调试接口、旅行模块的 Cookie 续期。
2. **App Router 的路由即目录** —— 新增页面不需要注册路由表。

> 改动这类代码前先读 `node_modules/next/dist/docs/` 里的对应文档，
> 不要依据旧版本经验编写。

---

## 二、部署拓扑

```
浏览器
  │  HTTPS（证书由 Cloudflare 提供）
  ▼
Cloudflare 边缘
  │  加密隧道
  ▼
cloudflared（本机常驻）
  │  HTTP 到本机回环
  ▼
Next.js  0.0.0.0:3000（PM2 管理）
  │
  ├──▶ Prisma ORM ──▶ SQLite
  │
  └──▶ 外部 API（DeepSeek / 高德 / 和风 / 飞常准 / RollingGo）
```

**关键点**：

- 服务器**不需要公网 IP**，**不开放任何入站端口**
- **隧道是唯一对外通路**，cloudflared 停止即网站下线
- HTTPS 与 DNS 都在 Cloudflare 侧，本机不配置证书

> **关于 nginx**：早期版本曾用 nginx 监听 80 并反代到 3000，但隧道的
> ingress 实际指向 `http://127.0.0.1:3000`，**请求从未经过 nginx**。
> 2026-10-17 实测其访问日志中非 127.0.0.1 的请求为 0 条，已停用。
> 局域网访问改用 `http://<本机IP>:3000`（Next.js 监听 0.0.0.0:3000）。

部署细节见 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

---

## 三、目录结构

| 目录 | 内容 |
| --- | --- |
| `app/` | 页面与接口（49 个顶层路由） |
| `app/api/` | 19 个接口分组（`news`、`events`、`industry`、`investment`、`travel` 等） |
| `lib/agents/` | 各智能体实现（含 `travel/` 出行管家） |
| `lib/ranking/` | 排序与评分算法 |
| `lib/news/`、`lib/rss/` | 采集与清洗 |
| `lib/intelligence/` | 事件聚类 |
| `lib/industry/`、`lib/industryMap/` | 产业链与热点 |
| `lib/investment/`、`lib/scoring/` | 投资评分 |
| `lib/ai/`、`lib/analysis/` | 模型调用与分析 |
| `components/` | React 组件（按模块分目录） |
| `prisma/` | Schema 与迁移 |
| `scripts/` | 采集、清洗、回填等一次性与批量任务 |
| `ai-context/` | AI 交接文档（即本目录） |

---

## 四、数据模型

共 15 张表，核心数据流：

```
Source（数据源，35 条）
  ↓  采集
News（新闻，1668 条）
  ↓  清洗 → 去重 → 质量分级
  ↓  AI 分析
NewsEvent（事件聚类，31 条）
  ↓  产业价值评分
  ↓  趋势归纳
IndustryTrend（产业趋势，40 条）
IndustryHotspot（产业热点，5 条）
  ↓
DailyReport（日报，10 条）
  ↓  商业与投资视角
Investment（投资标的，3 条）
BusinessOpportunity / BusinessReport

PageView（访问统计，474 条）
TripPlan（出行方案，24 条）—— 出行管家模块
```

> 上表数据量实测于 2026-10-16。数据库当前约 8.7 MB。
> 字段级说明见 [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)。

### 一条设计原则

**金额由确定性算法计算，AI 只负责编排内容。**
出行管家的预算、票价、里程等数字都来自代码计算或接口查询，
模型不参与数值计算——避免幻觉产生不可信的价格。

---

## 五、AI 流水线

```
数据采集（RSS）
  ↓
新闻清洗（正文提取、去广告、质量分级）
  ↓
重复检测与合并
  ↓
AI 分析（摘要、分类、产业相关性）
  ↓
事件聚类（同一事件的多篇报道归并）
  ↓
产业价值评分（heatScore → industryScore）
  ↓
趋势与热点归纳
  ↓
日报生成
```

**评分演变值得注意**：首页「今日重点」原先按 `heatScore` 排序，
但那只统计新闻数量与新近度，导致 arXiv 论文、开源项目更新这类
产出频繁的内容挤占焦点位。现改为 `industryScore`：

```
产业价值分 = 热度 + 企业权重 + 商业价值 + 投资价值 − 学术噪声
```

---

## 六、外部依赖

| 服务 | 用途 | 配置变量 |
| --- | --- | --- |
| DeepSeek | 内容分析与行程编排 | `DEEPSEEK_API_KEY` |
| 高德地图 | 地理编码、通勤、静态图 | `AMAP_WEB_KEY` |
| 和风天气 | 行程天气 | `QWEATHER_KEY`、`QWEATHER_HOST` |
| 飞常准 | 机票与火车票报价 | `VARIFLIGHT_API_KEY` |
| RollingGo | 酒店报价 | `ROLLINGGO_API_KEY` |

**已知限制**：

- 高德对单 Key 有 QPS 上限，并发请求会返回 `10021`。
  并发已降至 2，并内置退避重试。详见
  [`AI_TROUBLESHOOTING_GUIDE.md`](./AI_TROUBLESHOOTING_GUIDE.md) 的「陷阱二」。
- 高德**不提供景点门票价格**（实测 20 个景点全部无 `cost` 字段），
  门票金额依靠估算。
- 飞常准按调用计费（5-50 积分/次，1 积分 = ¥0.01）；
  `initialize`、`tools/list`、`getTodayDate` 免费，失败的调用不计费。

---

## 七、相关文档

| 文档 | 内容 |
| --- | --- |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | 部署与运维细节 |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) | 表结构与字段 |
| [`AI_TROUBLESHOOTING_GUIDE.md`](./AI_TROUBLESHOOTING_GUIDE.md) | 故障排查手册 |
| [`CODE_MAP.md`](./CODE_MAP.md) | 代码位置索引 |
| [`AI_DECISION_LOG.md`](./AI_DECISION_LOG.md) | 历史决策记录 |
| `RECOVERY.md`（项目根目录） | 电脑损坏后的重建步骤 |
| `AI-START-HERE.md`（项目根目录） | 改动流程与当前已知问题 |
