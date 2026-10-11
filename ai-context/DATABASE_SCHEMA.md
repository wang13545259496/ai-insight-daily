# AI Insight Daily 数据库真实结构 V1.0

本文件基于：

prisma/schema.prisma


数据库：

SQLite


ORM：

Prisma


---

# 数据模型列表


## Source

用途：

新闻来源管理。


作用：

记录：

- 来源名称
- 来源类型
- 来源地址
- 来源可信度



---


## News

用途：

核心新闻数据。


作用：

存储AI产业新闻。


包含：

- 新闻标题
- 正文内容
- 来源地址
- 验证状态
- 数据状态
- 去重信息
- AI分析结果



---


## DailyReport

用途：

每日AI产业报告。


作用：

保存每日自动生成的分析报告。



---


## BusinessOpportunity

用途：

商业机会发现。


作用：

记录AI产业创业机会、商业机会。



---


## BusinessReport

用途：

商业分析报告。


作用：

保存商业研究内容。



---


## Investment

用途：

投资观察。


作用：

记录AI产业投资相关信息。



---


## InvestmentFavorite

用途：

投资收藏。


作用：

记录用户关注的投资项目。



---


## InvestmentScore

用途：

投资评分。


作用：

保存AI对投资机会的评分结果。



---


## RSSLog

用途：

RSS采集日志。


作用：

记录新闻采集过程。


包括：

- 来源
- 时间
- 状态
- 错误信息



---


## NewsEvent

用途：

新闻事件聚合。


作用：

将相关新闻归纳为事件。


重要字段：

heatScore

事件热度。



---


## IndustryHotspot

用途：

产业热点。


作用：

记录AI产业热点方向。



---


## IndustryTrend

用途：

产业趋势分析。


作用：

记录长期趋势变化。



---


## PageView

用途：

访问统计。


作用：

记录页面访问数据。



---


# 数据关系原则


修改数据库前：

1. 必须查看 prisma/schema.prisma

2. 不直接修改数据库文件

3. 使用 Prisma migration 管理结构变化

4. 修改前检查已有数据影响



# AI维护注意事项


AI助手修改数据库相关代码时：

必须确认：

- Model名称
- 字段名称
- Relation关系
- 数据迁移影响


禁止根据猜测创建字段。


