#!/bin/bash

COMMAND=$1


case $COMMAND in


status)

echo "生成项目状态..."

./generate-ai-status.sh

;;


handover)

echo "刷新AI交接包..."

./refresh-ai-handover.sh

;;


health)

echo "执行项目健康检查..."

./daily-ai-maintenance.sh

;;


all)

echo "执行完整AI维护流程..."

./daily-ai-maintenance.sh

./generate-ai-status.sh

./refresh-ai-handover.sh

echo "全部完成"

;;


*)

echo ""
echo "AI Insight Daily 工具"
echo ""
echo "使用方式："
echo ""
echo "./ai-tools.sh status    生成项目状态"
echo "./ai-tools.sh health    健康检查"
echo "./ai-tools.sh handover  更新AI交接包"
echo "./ai-tools.sh all       执行全部维护"
echo ""

;;

esac
