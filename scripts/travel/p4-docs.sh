#!/bin/bash
# P4: sync the ai-context documentation after installing the travel agent.
#
# Updates (append-only where possible, to avoid clobbering existing content):
#   ai-context/DATABASE_SCHEMA.md        -> new TripPlan model section
#   ai-context/AI_DECISION_LOG.md        -> Level 3 decision record
#   ai-context/CODE_MAP.md               -> new module location
#   ai-context/PROJECT_STATUS_SNAPSHOT.md-> refreshed snapshot block
#
# All four files are backed up first.

set -e

P="$HOME/projects/ai-insight-daily"
STAMP=$(date +%Y%m%d-%H%M%S)
HEAD_SHA=$(git -C "$P" rev-parse --short HEAD)

cd "$P"
echo "########## P4 DOC SYNC ##########"
echo "project: $(pwd)"
echo "HEAD   : $HEAD_SHA"
echo

DOC=ai-context
mkdir -p _backup

# ---------- backup ----------
echo "[1/5] backup docs"
for f in DATABASE_SCHEMA.md AI_DECISION_LOG.md CODE_MAP.md PROJECT_STATUS_SNAPSHOT.md; do
  cp "$DOC/$f" "_backup/$f.before-travel-$STAMP"
  echo "  $DOC/$f -> _backup/$f.before-travel-$STAMP"
done
echo

# ---------- DATABASE_SCHEMA.md ----------
echo "[2/5] DATABASE_SCHEMA.md"
if grep -q "TripPlan" "$DOC/DATABASE_SCHEMA.md"; then
  echo "  already documented, skip"
else
  cat >> "$DOC/DATABASE_SCHEMA.md" <<'DOC'

================================

# 14. TripPlan

用途：

存储 AI 旅行规划 Agent 生成的完整行程方案。


新增时间：

2026-10-13


主要字段：


origin

destination

departDate

returnDate

adults

children

budget

style

interests

planJson

overview

quoteMode

generatedByAI

model


说明：


planJson 保存完整方案 JSON，包括预算分配、逐日行程、
交通与住宿报价、行前清单。

标量列（origin/budget/quoteMode 等）用于列表展示与检索，
避免为渲染列表而解析整份 JSON。


quoteMode 取值：


- live       交通与住宿均为实时报价
- partial    部分为实时报价
- estimate   全部为估算值


数据来源标注规则：

报价接口未配置或调用失败时降级为估算，
必须如实标注为 estimate，不得把估算值表现为真实价格。


关联模块：


lib/agents/travel/data.ts

app/api/travel/plan/route.ts


迁移文件：

prisma/migrations/20261015090000_add_trip_plan
DOC
  echo "  appended section 14"
fi
echo

# ---------- AI_DECISION_LOG.md ----------
echo "[3/5] AI_DECISION_LOG.md"
if grep -q "旅行规划Agent" "$DOC/AI_DECISION_LOG.md"; then
  echo "  already logged, skip"
else
  cat >> "$DOC/AI_DECISION_LOG.md" <<DOC

================================

# 决策记录：AI旅行规划Agent 立项与落地


日期：

2026-10-13


等级：

Level 3（数据库变化 + 新增模块）


决策：

将旅行规划作为 AI 智能体生态平台的第一个自研 Agent 落地，
业务逻辑置于 lib/agents/travel/，与 news / investment 等模块平级。


原因：


1. 项目路线为 V7 驾驶舱 → V8 知识库 → V9 Agent 生态，
   需要先验证「Agent 调用外部工具 + 大模型编排 + 结果落库」的完整链路。
2. 旅行规划是独立域，不污染 AI 产业分析主线，适合做试验田。


影响范围：


代码：

- 新增 lib/agents/travel/（业务逻辑）
- 新增 app/travel/、app/api/travel/（页面与接口）
- 新增 components/travel/（组件）
- 修改 components/Navbar.tsx（新增导航项，9 -> 10）


数据库：

- 新增 TripPlan 表
- 迁移文件 20261015090000_add_trip_plan
- 变更前已备份 dev.db


文档：

- DATABASE_SCHEMA.md 新增模型说明
- CODE_MAP.md 新增模块位置
- AI_TASK_QUEUE.md 登记 TASK-006


AI调用方式：


经 lib/agents/travel/ai.ts 调用模型，
使用项目统一的 DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL，
并启用 response_format=json_object，
不引入独立模型配置，符合 AI_API_INTEGRATION.md 方向。


关键设计决策：


1. 金额由确定性算法计算，大模型只负责行程内容，不参与算钱。
2. 报价接口不可用时降级为估算，并在方案中显式标注来源。
3. 模型输出不可用时降级为确定性模板，保证功能始终可用。


测试结果：


类型检查通过、ESLint 通过、448 项测试通过（其中旅行模块 118 项）、
生产构建通过。


Git基准：

$HEAD_SHA
DOC
  echo "  appended decision record"
fi
echo

# ---------- CODE_MAP.md ----------
echo "[4/5] CODE_MAP.md"
if grep -q "lib/agents/travel" "$DOC/CODE_MAP.md"; then
  echo "  already documented, skip"
else
  cat >> "$DOC/CODE_MAP.md" <<'DOC'

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
DOC
  echo "  appended section 11"
fi
echo

# ---------- PROJECT_STATUS_SNAPSHOT.md ----------
echo "[5/5] PROJECT_STATUS_SNAPSHOT.md"
if grep -q "旅行规划Agent" "$DOC/PROJECT_STATUS_SNAPSHOT.md"; then
  echo "  already recorded, skip"
else
  cat >> "$DOC/PROJECT_STATUS_SNAPSHOT.md" <<DOC

================================

# 新增能力（2026-10-13）


## AI旅行规划Agent


新增：

AI 智能体生态平台的第一个自研 Agent。
登记为 TASK-006，状态「规划中」。


功能：


- 输入出发地、目的地、去返程日期、人数、预算、偏好
- 生成含交通、住宿、餐饮、门票与逐日行程的完整方案
- 预算由确定性算法分配，各项之和恒等于总预算
- 方案落库并生成可分享链接


实现位置：


lib/agents/travel/

app/travel/

app/api/travel/

components/travel/


数据库变化：


新增 TripPlan 表（第 14 个模型）。

迁移文件 20261015090000_add_trip_plan。


当前运行模式：


报价：估算模式（Amadeus 凭据未配置，代码已就绪）

行程编排：DeepSeek（deepseek-chat）


测试状态：


类型检查：通过。

ESLint：通过。

测试：448/448 通过。

生产构建：通过。


Git基准：

$HEAD_SHA
DOC
  echo "  appended snapshot block"
fi
echo

# ---------- verify ----------
echo "===== VERIFY ====="
for f in DATABASE_SCHEMA.md AI_DECISION_LOG.md CODE_MAP.md PROJECT_STATUS_SNAPSHOT.md AI_TASK_QUEUE.md; do
  n=$(grep -c -i "travel\|TripPlan\|TASK-006" "$DOC/$f" || true)
  echo "  $f : $n matching lines"
done
echo
echo "--- git status ---"
git status --porcelain | grep -E "ai-context" || echo "  (none)"
echo
echo "P4 DONE"
