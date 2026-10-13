# AI Insight Daily 数据库结构说明 V1.0


## 数据库信息


类型：

SQLite


ORM：

Prisma



Schema文件：

prisma/schema.prisma



================================

# 核心数据流


数据来源


↓

Source


↓

News


↓

NewsEvent


↓

IndustryTrend


↓

Investment / BusinessOpportunity


↓

AI分析输出



================================

# 数据模型说明



# 1. Source


用途：

记录新闻来源。



主要信息：


来源名称。

来源地址。

来源类型。

可信度。



注意：

新增来源必须评估质量。



================================

# 2. News


用途：

核心新闻数据表。



保存：


标题。

正文。

来源。

发布时间。

链接。

AI分析结果。

质量状态。



重要字段：


sourceUrl

verified

dataStatus

duplicateHash

sourceCount



注意：

不要直接删除历史新闻。



================================

# 3. DailyReport


用途：

每日AI产业报告。



保存：


日期。

日报内容。

生成状态。



================================

# 4. NewsEvent


用途：

新闻事件聚合。



作用：

多个新闻形成一个产业事件。



例如：


多个模型发布新闻

↓

一个模型发布事件



重要字段：

heatScore



================================

# 5. IndustryTrend


用途：

记录产业趋势。



例如：


AI Agent

多模态模型

机器人



================================

# 6. BusinessOpportunity


用途：

记录AI商业机会。



内容：

机会方向。

市场分析。

相关行业。



================================

# 7. Investment


用途：

投资观察。



记录：


企业。

投资事件。

分析结果。



================================

# 8. InvestmentScore


用途：

投资评分。



用于：

企业评价。



================================

# 9. InvestmentFavorite


用途：

用户收藏投资对象。



================================

# 10. BusinessReport


用途：

商业分析报告。



================================

# 11. RSSLog


用途：

记录采集过程。



用于：

排查采集问题。



================================

# 12. IndustryHotspot


用途：

记录行业热点。



================================

# 13. PageView


用途：

访问统计。



================================

# 表关系


Source

↓

News


News

↓

NewsEvent


NewsEvent

↓

IndustryTrend



Investment

↓

InvestmentScore



================================

# 数据修改规则


禁止：

直接修改生产数据库。


禁止：

删除大量历史数据。



正确流程：


修改schema


↓

生成migration


↓

测试


↓

部署



================================

# AI维护注意事项


修改数据库前必须确认：


1.

影响哪些模块。


2.

是否需要迁移。


3.

是否影响已有数据。


4.

是否需要备份。



================================

# 数据质量要求


所有核心数据：


必须有来源。


必须可追溯。


必须避免重复。



================================

# 长期规划


未来扩展：


企业知识表。


模型知识表。


知识关系表。


Agent运行记录表。




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

================================

# TripPlan 扩展字段（2026-10-13，高德接入）

planJson 内部新增以下结构，均为「尽力而为」的可选字段，
高德未接入或接口失败时缺省，不影响方案主体。


## activities[].coordinates

高德解析出的坐标，格式 "lng,lat"。


## activities[].address

高德整理后的规范地址。


## activities[].commuteFromPrevious

从上一个活动到本活动的通勤方案：


from

to

distanceMeters

durationMinutes

mode        walk / transit / drive

summary     如「驾车/打车约 8.2 公里」


## itinerary[].commuteLegs

当日通勤段汇总，供页面整体展示。


## weather

逐日天气预报数组：


date

dayWeather

nightWeather

dayTemp

nightTemp

windDirection

windPower


## mapEnriched

本次是否附带真实地图数据（坐标与通勤）。


## 数据来源与限制


来源：高德地图 Web 服务 API。

覆盖：仅中国境内。境外目的地无 POI 与路径数据，此时静默跳过。


配额（个人认证开发者）：


地理编码 / 路径规划   150,000 次/月

POI 搜索 / 天气查询     5,000 次/月


省配额策略：

只对活动点位做地理编码、不批量搜 POI；每天最多 6 段通勤；
同一地点结果进程内缓存。


已知限制：


1. 高德天气预报仅覆盖未来数日。行程日期超出范围时，
   不展示任何天气并明确告警，不会用今天的天气冒充行程天气。

2. 海岛类景点（如蜈支洲岛）在路网数据中位于海上，
   公交规划可能返回 60 公里以上的失真结果。
   超过 120 分钟的公交方案会被判定为失真并丢弃。

3. 若同一天的活动确实分处不同片区，系统会校验并触发一次重排；
   重排仍不达标时如实告警，交由用户手动调整。
