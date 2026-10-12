# AI Insight Daily AI开发变更记录模板


## 版本：

例如：

V7.1


## 日期：

YYYY-MM-DD



## 修改类型：

选择：

- 新功能
- Bug修复
- 性能优化
- 数据修复
- 架构调整



---


# 1. 修改目标


说明：

为什么需要这次修改。


例如：

解决新闻采集过程中出现大量官网营销内容的问题。



---


# 2. 修改内容


涉及文件：


例如：

lib/crawler/web.ts

lib/pipeline/filter.ts


修改说明：

- 增加内容质量检测
- 增加来源验证
- 优化过滤规则



---


# 3. 数据库影响


是否修改 Prisma Schema：

是 / 否


是否需要 Migration：

是 / 否


影响模型：

例如：

News

NewsEvent



---


# 4. 测试结果


执行：


npm run build


结果：

成功 / 失败


测试页面：

例如：

/news

/events



---


# 5. 部署操作


执行：


pm2 restart ai-insight-daily


结果：

成功 / 失败



---


# 6. 风险说明


可能影响：

例如：

旧新闻数据需要重新分析。



---


# 7. 回滚方式


如果出现问题：

恢复文件：

xxx


执行：

xxx



---


# 8. 下一步计划


继续：

xxx



