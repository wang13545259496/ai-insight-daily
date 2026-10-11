#!/bin/bash

PROJECT_DIR=$(pwd)

echo "开始生成 AI-HANDOVER..."

rm -rf AI-HANDOVER
rm -f AI-HANDOVER.zip

mkdir -p AI-HANDOVER

echo "复制 AI 文档..."

cp -r ai-context AI-HANDOVER/


echo "复制项目核心文件..."

cp package.json AI-HANDOVER/

cp prisma/schema.prisma AI-HANDOVER/


if [ -f README.md ]; then
    cp README.md AI-HANDOVER/
fi


echo "生成压缩包..."

zip -r AI-HANDOVER.zip AI-HANDOVER >/dev/null


echo ""
echo "=============================="
echo "AI-HANDOVER 生成完成"
echo "=============================="

ls -lh AI-HANDOVER.zip
