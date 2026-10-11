# AI Insight Daily 代码地图 V1.0


# 项目目录结构


## app/

Next.js 页面和接口。


主要页面：


app/page.tsx

首页入口。


app/news/

新闻模块。


app/events/

事件中心。


app/industry/

产业链模块。


app/agent/

Agent生态模块。


app/models/

模型库模块。


app/investment/

投资观察模块。


app/opportunity-map/

机会地图模块。


app/admin/

后台管理。



---


# components/


公共UI组件。


包括：

- 页面组件
- 卡片组件
- 数据展示组件
- 导航组件



---


# lib/


核心业务逻辑。


## AI相关


负责：

- AI调用
- 新闻分析
- 内容生成



## crawler/


负责：

新闻采集。


包括：

- RSS
- 网页抓取
- 来源处理



## pipeline/


负责：

自动化数据流程。


流程：

采集

↓

清洗

↓

分析

↓

聚合

↓

生成报告



## 数据处理


负责：

- 去重
- 数据清洗
- 质量检测



---


# prisma/


数据库定义。


主要文件：

schema.prisma


作用：

定义：

- News
- NewsEvent
- DailyReport
- Investment
- Opportunity



---


# scripts/


维护脚本。


用途：

- 数据检查
- 数据修复
- 批处理任务



---


# public/


静态资源。


---


# 配置文件


package.json

项目依赖。


next.config

Next.js配置。


.env

环境变量。



---


# 核心业务流程


## 新闻流程


数据源

↓

crawler

↓

News数据库

↓

AI分析

↓

事件聚合

↓

前端展示



## 日报流程


新闻数据

↓

筛选

↓

AI总结

↓

DailyReport

↓

页面展示



---


# 修改指南


## 修改页面样式

优先查看：

app/

components/


## 修改采集

查看：

lib/crawler/


## 修改AI分析

查看：

lib/ai/

lib/pipeline/


## 修改数据库

查看：

prisma/schema.prisma


## 修改自动任务

查看：

cron相关接口和脚本。



