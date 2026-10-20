# AI Insight Daily 代码地图 V1.0


## 项目结构


主要目录：


app/

components/

lib/

prisma/

public/

scripts/

ai-context/



================================

# 一、页面层 app/


## 首页


位置：

app/page.tsx


职责：

AI产业驾驶舱首页。



---


## 新闻模块


位置：

app/news/


职责：

新闻列表。

新闻详情。

新闻展示。



---


## 事件模块


位置：

app/events/


职责：

AI产业事件展示。



---


## 行业模块


位置：

app/industry/


职责：

行业趋势分析。



---


## 运维脚本

位置：`scripts/`

| 脚本 | 作用 |
| --- | --- |
| `install-cron.sh` | 幂等安装全部定时任务（受管区块标记） |
| `news-pipeline-scheduler.sh` | 新闻采集调度，按陈旧度判断 |
| `health-monitor.sh` | 站点健康检查，状态变化才告警 |
| `alert.sh` | 告警分发（Server 酱 / Telegram / webhook） |
| `set-alert-channel.sh` | 配置告警渠道 |
| `ai-usage-report.sh` | AI 用量与成本报告 |
| `daily-report.sh` | 每日报告推送到微信 |
| `audit-contrast.py` | 按背景检查并修正文字对比度 |

报告读法与三个数据源的盲区见 `DEPLOYMENT.md`。


---

## 配色与对比度

全站有两套主题：深色页（`bg-black`）与浅色页（`bg-white`），
**且同一页面内也会混用**（首页白底但首屏是黑色 hero 区）。

同一个颜色类在两套主题下的对比度差别很大，例如 `text-gray-400`
在黑底是 8.27:1（合格）、在白底只有 2.54:1（不合格）。
**因此调整文字颜色不能按文件整体替换。**

工具：`scripts/audit-contrast.py`

```bash
python3 scripts/audit-contrast.py --dry-run   # 预演，报告将改哪些
python3 scripts/audit-contrast.py             # 实际修改
```

它用标签栈跟踪每处文字所处的背景，再决定调整方向：

| 背景 | 低对比度类 | 改为 |
| --- | --- | --- |
| 深色 | gray-500 / 600 / 700 | gray-400 |
| 浅色 | gray-400 | gray-600 |

脚本会跳过注释行 —— 注释里的颜色说明是改动原因的记录，不应被替换。

跨主题组件（如 `NewsTitle`）不要用固定颜色，改用 `opacity-70`
继承父级颜色，两套主题下都能达标。


---

## 合规页

位置：

app/about/

app/privacy/


职责：

关于本站（内容如何生成、局限、来源与版权、联系方式、免责声明）
与隐私说明（收集什么、不收集什么、第三方、用户权利）。

进入方式：全局页脚（components/Footer.tsx），在 app/layout.tsx 中渲染。


---


## 实体模块


位置：

app/entities/

app/entities/[id]/


职责：

实体库。列出公司 / 模型 / 产品 / 人物，详情页显示该实体的
关联事件、相关新闻（主体优先）与共同出现主体。

数据来自 Entity / NewsEntity / EventEntity 三表，
由 scripts/linkEventEntities.ts 与 scripts/linkNewsEntities.ts 建立。


---


## 投资模块


位置：

app/investment/


职责：

投资观察。



---


## Agent模块


位置：

app/agent/


职责：

未来Agent入口。



---


## 管理后台


位置：

app/admin/


职责：

后台管理。



================================

# 二、组件层 components/


职责：


公共UI组件。


页面复用组件。


数据展示组件。



修改页面显示：

优先检查这里。



================================

# 三、业务逻辑 lib/


## 数据采集


位置：

lib/crawler/


职责：

新闻来源抓取。



---


## AI分析


位置：

lib/ai/


职责：

模型调用。

内容分析。

摘要生成。



---


## 数据处理


位置：

lib/


职责：

业务逻辑。

数据转换。

工具函数。



================================

# 四、数据库层 prisma/


## Schema


文件：

prisma/schema.prisma



职责：

数据库模型定义。



主要模型：


News


NewsEvent


DailyReport


Investment


BusinessOpportunity


IndustryTrend



================================

# 五、API接口


位置：

app/api/


职责：

前后端数据交互。



主要包括：


新闻接口。


AI分析接口。


定时任务接口。



================================

# 六、自动任务


位置：


scripts/


以及：


app/api/cron/



职责：


每日采集。


AI分析。


事件生成。


报告生成。



================================

# 七、配置文件


package.json


职责：

依赖管理。



.env


职责：

环境变量。



next.config.js


职责：

Next配置。



================================

# 八、修改指导


修改页面：

先看：

app/

components/



修改数据：

先看：

prisma/

lib/



修改AI：

先看：

lib/ai/



修改采集：

先看：

lib/crawler/



修改自动任务：

先看：

app/api/cron/

scripts/



================================

# 九、开发原则


不要：

随意新增重复模块。


不要：

绕过已有业务逻辑。


不要：

直接修改数据库文件。



修改前：

确认：

数据流。

影响范围。

测试方案。



================================

# 十、持续维护


代码结构变化时：

必须同步更新：

CODE_MAP.md



保持：

AI永远知道项目结构。




================================

# 十一、Agent 模块

## 旅行规划 Agent

位置：`lib/agents/travel/`

职责：旅行方案生成的全部业务逻辑（编排、报价、预算、地图、导出）。

### 业务逻辑

| 文件 | 作用 |
| --- | --- |
| `types.ts` | 领域模型 |
| `date.ts` | 日期推算 |
| `validation.ts` | 输入校验 |
| `cities.ts` | 城市 → IATA 三字码 |
| `budget.ts` | 预算分配（确定性算法） |
| `itinerary.ts` | 行程编排与成本回填 |
| `prompt.ts` | 提示词构建 |
| `ai.ts` | 模型调用层 |
| `planner.ts` | 主流程编排 |
| `data.ts` | 数据访问层（TripPlan） |
| `providers.ts` / `amadeus.ts` / `variflight.ts` | 机票报价 |
| `rollinggo.ts` | 酒店报价 |
| `intercityOptions.ts` / `fareEstimate.ts` / `stationRank.ts` | 跨城方式（火车 / 自驾）对比 |
| `amap.ts` | 高德：POI 检索、坐标补齐、通勤、天气 |
| `weather.ts` | 逐日天气（和风） |

### 逐日路线图（2026-10-20 重做）

| 文件 | 作用 |
| --- | --- |
| `daymap-core.ts` | **纯计算**：编号合并、取景（按跨度算 zoom）、Web 墨卡托投影、折线抽稀。浏览器与服务端共用，无 Node 依赖 |
| `daymap.ts` | **渲染**：只向高德要底图，用 sharp 叠加编号圆点与路线，输出 PNG（网页与 Word 共用） |
| `staticmap.ts` | 兜底路径：高德自带的 markers + paths 静态图（方案未落库时使用） |

### 页面

| 路径 | 作用 |
| --- | --- |
| `app/agent-travel/page.tsx` | 表单 + 状态条 + 历史方案 |
| `app/agent-travel/[id]/page.tsx` | 方案分享页（按归属鉴权） |
| `app/agent-travel/login/page.tsx` | 口令 / 邀请码登录 |
| `app/agent-travel/invites/page.tsx` | 邀请码管理（仅维护者） |

### 接口

| 路径 | 作用 |
| --- | --- |
| `app/api/travel/plan/route.ts` | POST 生成（支持 NDJSON 流式进度）/ GET 列表 |
| `app/api/travel/plan/[id]/route.ts` | GET 单条方案 |
| `app/api/travel/[id]/download/route.ts` | 导出 Word（full / compact / day） |
| `app/api/travel/[id]/map/route.ts` | **逐日路线图 PNG**（?day=N，鉴权 + 归属校验 + 进程内缓存） |
| `app/api/travel/auth/route.ts` | 口令与邀请码登录 |
| `app/api/travel/invites/route.ts` | 邀请码增删 |

### 组件

位置：`components/agent-travel/`

| 文件 | 作用 |
| --- | --- |
| `TripPlannerForm.tsx` | 表单与结果容器（客户端） |
| `PlanView.tsx` | 方案展示；逐日卡片含地图与编号圆点 |
| `InviteManager.tsx` | 邀请码管理 |
| `TravelLoginForm.tsx` / `TravelLogoutButton.tsx` | 登录态入口 |

### 导出

| 文件 | 作用 |
| --- | --- |
| `export.ts` | 文档结构（区块取舍） |
| `exportDocx.ts` | 结构 → .docx |
| `exportImages.ts` | 逐日图取回（串行 + 间隔，避免高德限流） |

### 数据表

`TripPlan`（方案 JSON + 归属）、`TravelInvite`（一次性邀请码）

### 诊断脚本

位置：`scripts/travel/`

| 文件 | 作用 |
| --- | --- |
| `check-amap.ts` | 高德 Key 与接口诊断 |
| `check-amadeus.ts` | Amadeus 凭据诊断 |
| `check-qweather.ts` | 和风天气诊断 |
| `check-db.ts` | 方案落库自洽性检查 |
| `e2e.ts` | 端到端验证 |
