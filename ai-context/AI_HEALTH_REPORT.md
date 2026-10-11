# AI Insight Daily 健康报告

生成时间：

Sun Oct 11 10:20:57 CST 2026



================================

# Git状态


当前分支：

main


工作区状态：

 M ai-context/AI_HEALTH_REPORT.md
 M ai-context/ENVIRONMENT.md
 M app/admin/news/page.tsx
 M app/admin/system/page.tsx
 M app/agent/page.tsx
 M app/agents/page.tsx
 M app/api/ai/summary/route.ts
 M app/api/cron/daily/route.ts
 M app/api/cron/pipeline/route.ts
 M app/api/test/pipeline/route.ts
 M app/events/[id]/page.tsx
 M app/events/page.tsx
 M app/industry/page.tsx
 M app/investment/[id]/page.tsx
 M app/investment/page.tsx
 M app/layout.tsx
 M app/models/page.tsx
 M app/news/[id]/page.tsx
 M app/news/page.tsx
 M app/opportunity-map/[id]/page.tsx
 M app/opportunity-map/page.tsx
 M app/page.tsx
 M app/search/page.tsx
 M app/trend/page.tsx
 M app/trend/predict/page.tsx
 M components/Navbar.tsx
 D data/investment.ts
 M lib/ai-summary.ts
 M lib/ai.ts
 M lib/crawler/sourceConfig.ts
 M lib/crawler/web.ts
 M lib/daily/generateDailyReport.ts
 M lib/daily/saveDailyReport.ts
 M lib/events/eventScore.ts
 M lib/intelligence/eventCluster.ts
 M lib/intelligence/linkNewsEvent.ts
 M lib/investment/export.ts
 D lib/investment/report.ts
 D lib/investment/score.ts
 M lib/news/getHotNews.ts
 M lib/news/hotScore.ts
 M lib/news/predictTrend.ts
 M lib/news/trend.ts
 M lib/ranking/investmentRanking.ts
 M lib/report-generator.ts
 M lib/rss.ts
 M lib/rss/storage/saveRSSNews.ts
 M lib/scheduler/newsPipeline.ts
 M lib/scoring/investmentScore.ts
 M prisma/schema.prisma
 M prisma/seedInvestment.ts
 M scripts/classifyEventQuality.ts
 M scripts/cleanNewsContent.ts
 M scripts/collectNews.ts
 M scripts/server-health.sh
 M scripts/updateSources.ts
?? AI-HANDOVER/
?? ai-context/AI_TASK_QUEUE.md
?? ai-context/PROJECT_MEMORY.md
?? ai-tools.sh
?? app/admin/data/
?? app/api/admin/system-health/
?? app/api/analytics/
?? app/models/page.tsx.backup_20261010_224909
?? app/page.v7-final-backup.tsx
?? app/page.v748126.tsx.bak
?? components/analytics/
?? lib/crawler/qualityScore.backup.v748130.ts
?? lib/crawler/qualityScore.backup.v748131.ts
?? lib/crawler/qualityScore.ts
?? lib/crawler/webFetcher.backup.v748112.ts
?? lib/crawler/webFetcher.backup.v748123.ts
?? lib/crawler/webFetcher.backup.v748129.ts
?? lib/crawler/webFetcher.backup.v748133.ts
?? lib/crawler/webFetcher.ts
?? lib/crawler/webSources.ts
?? lib/events/eventScore.backup.v748141.ts
?? lib/intelligence/eventCluster.backup.v748111.ts
?? lib/intelligence/eventCluster.backup.v748140.ts
?? lib/intelligence/eventCluster.backup.v748142.ts
?? lib/intelligence/refreshEvents.ts
?? lib/news/contentCleaner.backup.ts
?? lib/news/contentCleaner.ts
?? lib/news/contentQualityScore.ts
?? lib/news/newsEnricher.ts
?? lib/news/newsTypeClassifier.ts
?? prisma/schema.backup.v748121
?? prisma/schema.before-investment-source.prisma
?? scripts/backfillPublishedAt.ts
?? scripts/checkContentQuality.ts
?? scripts/checkNewsCompleteness.ts
?? scripts/checkNewsQuality.ts
?? scripts/cleanBadNews.ts
?? scripts/cleanEvents.ts
?? scripts/cleanNewsContent.backup.ts
?? scripts/collectNews.backup.v748111.ts
?? scripts/collectNews.backup.v748122.ts
?? scripts/collectNews.backup.v748124.ts
?? scripts/collectNews.backup.v748128.ts
?? scripts/collectNews.backup.v748131.ts
?? scripts/collectNews.backup.v748132.ts
?? scripts/collectNews.backup.v748133.ts
?? scripts/collectNews.backup.v748134.ts
?? scripts/enrichAIAnalysis.ts
?? scripts/enrichShortNews.ts
?? scripts/filterIndustryEvents.ts
?? scripts/markRepairNews.ts
?? scripts/restoreInactiveNews.ts



最近提交：

bc67c45 add AI project health check system



================================

# Node环境


Node：

v22.23.3


npm：

10.9.9



================================

# 依赖检查


ai-news-website@0.1.0 /home/administrator/projects/ai-insight-daily
├── @emnapi/core@1.10.0 extraneous
├── @emnapi/runtime@1.11.3 extraneous
├── @emnapi/wasi-threads@1.2.1 extraneous
├── @img/sharp-wasm32@0.35.4 extraneous
├── @napi-rs/wasm-runtime@1.2.4 extraneous
├── @prisma/client@6.19.3
├── @tailwindcss/postcss@4.3.3
├── @tybys/wasm-util@0.10.4 extraneous
├── @types/node@20.19.43
├── @types/react-dom@19.3.0
├── @types/react@19.3.0
├── axios@1.20.0
├── eslint-config-next@16.3.5
├── eslint@9.39.5
├── jspdf@4.2.1
├── next@16.3.5
├── openai@7.21.0
├── prisma@6.19.3
├── react-dom@19.2.8
├── react@19.2.8
├── recharts@3.10.1
├── rss-parser@3.13.0
├── tailwindcss@4.3.3
├── tsx@4.23.15
└── typescript@5.9.3



================================

# Prisma检查


Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

5 migrations found in prisma/migrations

Database schema is up to date!



================================

# 数据库连接测试


数据库连接正常



================================

# 构建检查


执行：

npm run build


结果：

请根据需要执行。



================================

# PM2状态


┌────┬─────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name                │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼─────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 1  │ ai-insight-daily    │ default     │ N/A     │ fork    │ 551      │ 48m    │ 0    │ online    │ 0%       │ 69.5mb   │ adminis… │ disabled │
└────┴─────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
Module
┌────┬──────────────────────────────┬───────────────┬──────────┬──────────┬──────┬──────────┬──────────┬──────────┐
│ id │ module                       │ version       │ pid      │ status   │ ↺    │ cpu      │ mem      │ user     │
├────┼──────────────────────────────┼───────────────┼──────────┼──────────┼──────┼──────────┼──────────┼──────────┤
│ 0  │ pm2-logrotate                │ 3.0.0         │ 527      │ online   │ 0    │ 0%       │ 72.6mb   │ adminis… │
└────┴──────────────────────────────┴───────────────┴──────────┴──────────┴──────┴──────────┴──────────┴──────────┘
host metrics | cpu: 0.2% | ram usage: 10.1% | disk: ⇓ 0mb/s ⇑ 0.015mb/s



================================

# AI建议


请AI助手根据以上状态：

1. 判断项目健康程度

2. 发现潜在风险

3. 提出优化建议



