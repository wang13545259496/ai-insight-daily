#!/bin/bash

echo "================================"
echo "刷新 AI Insight Daily 交接包"
echo "================================"


PROJECT_DIR=$(pwd)


echo ""
echo "1. 更新环境信息"


cat > ai-context/ENVIRONMENT.md <<EOT
# AI Insight Daily 运行环境信息

更新时间：

$(date)


## Git信息


当前分支：

$(git branch --show-current)


当前提交：

$(git log -1 --oneline)


最近提交：

$(git log -5 --oneline)



## Node环境


Node：

$(node -v)


npm：

$(npm -v)



## 核心依赖


$(grep -E '"next"|"react"|"prisma"|"@prisma/client"' package.json)



## Prisma


$(npx prisma -v 2>/dev/null | head -10)



## 系统


$(uname -a)



## 项目路径


$(pwd)

EOT



echo ""
echo "2. 更新交接包"


./update-ai-handover.sh


echo ""
echo "3. 完成"


ls -lh AI-HANDOVER.zip

