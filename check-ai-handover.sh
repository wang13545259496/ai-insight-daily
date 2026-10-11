#!/bin/bash

echo "=============================="
echo " AI-HANDOVER 完整性检查"
echo "=============================="

FILE="AI-HANDOVER.zip"

if [ ! -f "$FILE" ]; then
    echo "❌ 未找到 $FILE"
    exit 1
fi

echo "✅ 找到交接包"

echo ""
echo "检查核心文档..."

FILES=(
"AI_MASTER_INDEX.md"
"AI_START_PROMPT.md"
"AI_STARTUP_CHECKLIST.md"
"PROJECT_MEMORY.md"
"CURRENT_STATUS.md"
"PROJECT_STATUS_SNAPSHOT.md"
"CODE_MAP.md"
"DATABASE.md"
"DATABASE_SCHEMA.md"
"ENVIRONMENT.md"
"DEPLOYMENT.md"
"AI_TASK_QUEUE.md"
"AI_CHANGE_MANAGEMENT.md"
"AI_AUTOMATION_WORKFLOW.md"
"AI_VERSION_INFO.md"
"AI_DEVELOPMENT_WORKFLOW.md"
)

ERROR=0

for f in "${FILES[@]}"
do
    if unzip -l "$FILE" | grep -q "$f"; then
        echo "✅ $f"
    else
        echo "❌ 缺少 $f"
        ERROR=1
    fi
done


echo ""
echo "检查压缩包..."

if unzip -t "$FILE" >/dev/null; then
    echo "✅ 压缩包完整"
else
    echo "❌ 压缩包损坏"
    ERROR=1
fi


echo ""
echo "检查完成"

if [ $ERROR -eq 0 ]; then
    echo "=============================="
    echo " AI-HANDOVER 状态正常"
    echo "=============================="
else
    echo "=============================="
    echo " AI-HANDOVER 存在问题"
    echo "=============================="
fi

exit $ERROR
