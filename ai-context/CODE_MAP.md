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

位置：

lib/agents/travel/


职责：


旅行方案生成的全部业务逻辑。


文件分工：


types.ts        领域模型

date.ts         日期推算

validation.ts   输入校验

cities.ts       城市到 IATA 三字码

budget.ts       预算分配算法（确定性）

itinerary.ts    行程编排与成本回填

prompt.ts       提示词构建

providers.ts    报价 Provider 抽象与估算降级

amadeus.ts      真实报价接入（未启用）

ai.ts           模型调用层

data.ts         数据访问层

planner.ts      主流程编排


---

页面：


位置：app/travel/

app/travel/page.tsx       表单与结果

app/travel/[id]/page.tsx  方案分享页


---

接口：


位置：app/api/travel/plan/

route.ts        POST 生成 / GET 列表

[id]/route.ts   GET 单条


---

组件：


位置：components/travel/

TripPlannerForm.tsx   表单（客户端）

PlanView.tsx          方案展示（服务端）


---

数据表：

TripPlan


---

诊断脚本：


位置：scripts/travel/

check-amap.ts        高德 Key 与接口诊断

check-amadeus.ts     Amadeus 凭据诊断

check-qweather.ts    和风天气诊断

check-db.ts          方案落库自洽性检查

e2e.ts               端到端验证
