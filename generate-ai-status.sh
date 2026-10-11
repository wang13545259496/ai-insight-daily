#!/bin/bash

echo "生成 AI 项目状态报告..."

cat > ai-context/CURRENT_STATUS.md <<EOT
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


echo "CURRENT_STATUS.md 已更新"

