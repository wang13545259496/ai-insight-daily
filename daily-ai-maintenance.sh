#!/bin/bash

echo "开始 AI Insight Daily 健康检查..."

REPORT="ai-context/AI_HEALTH_REPORT.md"


cat > $REPORT <<EOT
# AI Insight Daily 健康报告

生成时间：

$(date)



================================

# Git状态


当前分支：

$(git branch --show-current)


工作区状态：

$(git status --short)



最近提交：

$(git log -1 --oneline)



================================

# Node环境


Node：

$(node -v)


npm：

$(npm -v)



================================

# 依赖检查


$(npm ls --depth=0 2>/dev/null | head -30)



================================

# Prisma检查


$(npx prisma migrate status 2>&1)



================================

# 数据库连接测试


$(node <<'NODE'
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test(){

try{

await prisma.$queryRaw`SELECT 1`;

console.log("数据库连接正常");

}catch(e){

console.log("数据库连接失败");

}

await prisma.$disconnect();

}

test();
NODE
)



================================

# 构建检查


执行：

npm run build


结果：

请根据需要执行。



================================

# PM2状态


$(pm2 status 2>/dev/null)



================================

# AI建议


请AI助手根据以上状态：

1. 判断项目健康程度

2. 发现潜在风险

3. 提出优化建议



EOT


echo "健康报告生成完成：$REPORT"

