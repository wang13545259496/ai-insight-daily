# AI Insight Daily 健康报告

生成时间：

Sat Oct 17 13:45:35 CST 2026



================================

# Git状态


当前分支：

main


工作区状态：

 M AGENTS.md
 M AI-START-HERE.md
 M ai-context/AI_HEALTH_REPORT.md
 M ai-context/CODE_MAP.md
 M ai-context/CURRENT_STATUS.md
 M ai-context/DATABASE.md
 M ai-context/FEATURES.md
 M ai-context/PROJECT_STATUS_SNAPSHOT.md
 M ai-context/TODO.md
 M generate-ai-status.sh
?? ai-context/AI_STATUS_AUTO.md



最近提交：

e3e05f2 fix(docs): 交接包内版本标记是旧的 —— 修正更新步骤顺序



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
├── docx@9.11.0
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

12 migrations found in prisma/migrations
Following migration have not yet been applied:
20261014120000_add_event_industry_score

To apply migrations in development run prisma migrate dev.
To apply migrations in production run prisma migrate deploy.



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
│ 1  │ ai-insight-daily    │ default     │ N/A     │ fork    │ 8353     │ 17m    │ 2    │ online    │ 0%       │ 69.2mb   │ adminis… │ disabled │
└────┴─────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
Module
┌────┬──────────────────────────────┬───────────────┬──────────┬──────────┬──────┬──────────┬──────────┬──────────┐
│ id │ module                       │ version       │ pid      │ status   │ ↺    │ cpu      │ mem      │ user     │
├────┼──────────────────────────────┼───────────────┼──────────┼──────────┼──────┼──────────┼──────────┼──────────┤
│ 0  │ pm2-logrotate                │ 3.0.0         │ 437      │ online   │ 0    │ 0%       │ 78.2mb   │ adminis… │
└────┴──────────────────────────────┴───────────────┴──────────┴──────────┴──────┴──────────┴──────────┴──────────┘
host metrics | cpu: 0.4% | ram usage: 10.4% | eth1: ⇓ 0mb/s ⇑ 0.001mb/s | disk: ⇓ 0.009mb/s ⇑ 0.011mb/s /usr/lib/linux-tools/6.18.54.1-microsoft-standard-WSL2 100%



================================

# AI建议


请AI助手根据以上状态：

1. 判断项目健康程度

2. 发现潜在风险

3. 提出优化建议



