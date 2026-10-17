#!/bin/bash

echo "生成 AI 项目状态报告..."

# 注意：输出到独立文件，不覆盖手写的 CURRENT_STATUS.md。
# 原因：CURRENT_STATUS.md 含大量叙述性内容（核心功能、AI能力、
# 优化方向、已知问题、接手提示），本脚本只能生成机械快照，
# 直接覆盖会丢掉 300 余行有价值的手写内容（2026-10-17 实测）。
cat > ai-context/AI_STATUS_AUTO.md <<EOT
# AI Insight Daily 当前状态报告

自动生成时间：

$(date)


================================

# Git状态


当前分支：

$(git branch --show-current)


最新提交：

$(git log -1 --oneline)



================================

# 项目环境


Node：

$(node -v)


npm：

$(npm -v)



================================

# 数据库状态


数据库：

SQLite


Prisma：

$(npx prisma -v 2>/dev/null | grep "prisma")



数据统计：


$(node <<'NODE'
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main(){
  try {

    const result = {
      News: await prisma.news.count(),
      NewsEvent: await prisma.newsEvent.count(),
      DailyReport: await prisma.dailyReport.count(),
      Investment: await prisma.investment.count(),
      Opportunity: await prisma.businessOpportunity.count()
    };

    console.log(JSON.stringify(result,null,2));

  } catch(e){
    console.log("数据库统计失败");
  }

  await prisma.\$disconnect();
}

main();
NODE
)



================================

# PM2状态


$(pm2 status 2>/dev/null)



================================

# 当前任务


请阅读：

AI_TASK_QUEUE.md


================================

EOT


echo "AI_STATUS_AUTO.md 已更新"

