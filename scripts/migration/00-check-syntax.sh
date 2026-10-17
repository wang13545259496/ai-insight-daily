#!/bin/bash
# 语法检查所有迁移脚本
set -u
D="/mnt/d/Backup/Documents/deepseek-harness/default-workspace/scripts/migration"

echo "=== bash 语法检查 ==="
for F in "$D"/*.sh; do
    if bash -n "$F" 2>/tmp/err.txt; then
        printf '  ✓ %-28s %s 行\n' "$(basename "$F")" "$(wc -l < "$F")"
    else
        printf '  ✗ %-28s\n' "$(basename "$F")"
        sed 's/^/      /' /tmp/err.txt
    fi
done

echo ""
echo "=== 检查是否有 CHANGE_ME 占位符（迁移前必须替换）==="
grep -l 'CHANGE_ME' "$D"/*.sh 2>/dev/null | while read -r f; do
    printf '  %-28s ' "$(basename "$f")"
    grep -c 'CHANGE_ME' "$f"
done

echo ""
echo "=== 检查可执行权限 ==="
ls -la "$D"/*.sh | awk '{printf "  %-30s %s\n", $9, $1}'

echo ""
echo "=== 检查变量引用是否都有默认值 ==="
for V in DEPLOY_SERVER DEPLOY_APP_DIR DEPLOY_PM2_NAME DEPLOY_BRANCH; do
    N=$(grep -l "$V" "$D"/*.sh 2>/dev/null | wc -l)
    printf '  %-18s 被 %s 个脚本使用\n' "$V" "$N"
done
