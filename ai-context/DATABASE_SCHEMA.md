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

================================

# TripPlan 新增字段：fingerprint（2026-10-13）


用途：

需求指纹。由出发地、目的地、日期、人数、预算、档位、偏好、
补充要求归一化后取 SHA256 前 32 位。


为什么需要：

一次生成要调用大模型并发出数十次地图请求。用户连点两次提交
或刷新重试会造成重复消耗。指纹让同一需求重复提交时命中已有记录。


规则：


唯一索引。重复提交时先删除旧记录再写入新结果，
既避免唯一冲突，又保证「重新生成」拿到的是最新方案。


归一化细节：


城市名去空格并转小写；偏好排序后再拼接（顺序不影响指纹）；
生成时间等无关字段不参与计算。


迁移文件：

prisma/migrations/20261015120000_add_tripplan_fingerprint


注意：

fingerprint 允许为 NULL。SQLite 唯一索引允许多个 NULL，
因此升级前写入的历史记录不会与新记录冲突。


================================
# 旅行模块：不入库的部分（2026-10-16 补充）

为什么单列一节：

旅行模块有两块设计与数据库无关，但维护时容易误以为「找不到表就是没实现」——
访问控制与行程单导出都不持久化任何数据，特此说明。

## 访问控制：无状态，不建表

实现：

lib/travel-access.ts、lib/travel-access-server.ts、proxy.ts

设计：

不引入会话表。访问令牌由 HMAC 派生 ——
以 TRAVEL_PASSWORD 为密钥、固定消息为内容做 SHA-256，取十六进制结果。
存于 Cookie travel_access。

为什么这样设计：

1. 个人项目不值得引入会话存储与其清理逻辑。
2. 服务端不存 session，重启后登录态不失效。
3. Cookie 里放的是派生值而非口令，泄露也无法反推口令。

有效期：

30 天，且每次访问自动续期（空闲 30 天才需重新登录）。
续期在 proxy.ts 里完成，不改令牌值、只刷新过期时间。

口令来源：

环境变量 TRAVEL_PASSWORD。未设置时该模块完全公开 ——
这样本地开发与首次部署不会因为漏配变量而把自己锁在门外。

访问模型（三层，各有分工）：

页面公开 —— 任何人都能看表单与页面。
生成与读取接口需登录 —— 返回 401 加 code: TRAVEL_AUTH_REQUIRED。
历史方案列表仅登录可见 —— 服务端按登录态决定是否查库。

第三条尤其要注意：

若照常查询再用 CSS 隐藏，用户的行程记录已经随 HTML 下发，等于没有保护。

## 行程单导出：即时生成，不落盘

实现：

lib/agents/travel/export.ts —— 组装内容
lib/agents/travel/exportDocx.ts —— 生成 Word
lib/agents/travel/exportImages.ts —— 取逐日路线图

路由：

app/api/travel/[id]/download/route.ts

不建表的原因：

文档由 planJson 即时渲染，没有需要独立保存的状态。
每次请求都从 TripPlan 读取后重新生成。

三种导出模式（由查询参数控制）：

mode=full —— 默认，完整版
mode=compact —— 精简版，去掉行前准备与数据说明
mode=day 加 day=N —— 单日版
maps=0 —— 关闭路线图嵌入

为什么导出 Word 而不是 PDF：

PDF 方案必须嵌入中文字体（中文子集通常 10MB 以上），
而 Word 文档由阅读端提供字体，成品仅十几 KB 且可编辑。

## 路线图为什么不在数据库里

逐日路线图（真实道路折线）存于 TripPlan.planJson 的 dayRoutePolylines 字段，
不单独建表。取图时由服务端向高德实时请求后嵌入文档，
URL 与高德 Key 都不写入文档 —— 文档会被转发，写进去等于泄露 Key。

## 关于 /api/travel 路径未改名的说明

出行管家模块的页面路径已由 /travel 改为 /agent-travel，
但接口路径 /api/travel 有意保留未改：

它是内部实现细节，改动会牵动多处 fetch 且无外部收益。
旧页面路径通过 next.config.ts 的 308 跳转保留可用。


================================
# 数据量快照（2026-10-16 实测）

用途：

判断数据是否正常增长的基线。若某表数量长期不增，说明对应流水线可能中断。

表名与记录数：

Source 35
News 1668
NewsEvent 31
IndustryHotspot 5
IndustryTrend 40
DailyReport 10
Investment 3
TripPlan 24
PageView 474

数据库文件大小：

prisma/dev.db 约 8.7 MB

说明：

PageView 记录访问统计，增长最快。
Investment 只有 3 条属于正常 —— 该模块要求证据完整度达标才收录，宁少不滥。
