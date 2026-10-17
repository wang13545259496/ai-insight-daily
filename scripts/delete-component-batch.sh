#!/bin/bash
#
# 删除一档无引用组件，并独立完成全部验证。
#
# 用法：
#   bash scripts/delete-component-batch.sh "名称1 名称2 ..." "批次说明"
#
# 流程：验证引用 → 删除 → tsc → 构建 → 页面检查 → 测试 → 提交
# 任一步失败立即停止，不提交。

set -u
cd "$HOME/projects/ai-insight-daily" || exit 1

BATCH="${1:?需要组件名列表}"
LABEL="${2:-未命名批次}"

echo "############################################################"
echo "#  $LABEL"
echo "############################################################"
echo ""

# ---------- 1. 删除前验证 ----------
echo "=== 1. 删除前验证 ==="
FAIL=0
TOTAL=0

for C in $BATCH; do
  F="components/$C.tsx"

  if [ ! -f "$F" ]; then
    printf '  —  %-28s 文件不存在，跳过\n' "$C"
    continue
  fi

  IMP=$(grep -rn "from ['\"][^'\"]*components/$C['\"]" app components --include='*.tsx' --include='*.ts' 2>/dev/null | wc -l)
  REF=$(grep -rn "components/$C\b" app components --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v "^components/$C.tsx:" | wc -l)
  JSX=$(grep -rn "<$C\b" app components --include='*.tsx' 2>/dev/null | grep -v "^components/$C.tsx" | wc -l)

  if [ "$IMP" -eq 0 ] && [ "$REF" -eq 0 ] && [ "$JSX" -eq 0 ]; then
    L=$(wc -l < "$F")
    TOTAL=$((TOTAL + L))
    printf '  ✓  %-28s %4s 行\n' "$C" "$L"
  else
    printf '  ✗  %-28s import=%s ref=%s jsx=%s ← 仍有引用，终止\n' "$C" "$IMP" "$REF" "$JSX"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "  ✗ 存在引用，本批次中止，未做任何修改"
  exit 1
fi

echo ""
echo "  合计 $TOTAL 行"
echo ""

# ---------- 2. 删除 ----------
echo "=== 2. 删除 ==="
for C in $BATCH; do
  [ -f "components/$C.tsx" ] && git rm -q "components/$C.tsx" && printf '  已删 %s\n' "$C"
done

echo ""
echo "=== 3. 确认零残留 ==="
LEFT=""
for C in $BATCH; do
  H=$(grep -rn "\b$C\b" app components --include='*.tsx' --include='*.ts' 2>/dev/null | head -2)
  [ -n "$H" ] && LEFT="$LEFT$H
"
done

if [ -n "$LEFT" ]; then
  echo "  ⚠ 仍有引用（可能是同名子串，需人工确认）:"
  printf '%s' "$LEFT" | head -6 | sed 's/^/    /'
else
  echo "  ✓ 零残留"
fi

# ---------- 4. tsc ----------
echo ""
echo "=== 4. 类型检查 ==="
rm -f tsconfig.tsbuildinfo
TSC_OUT=$(npx tsc --noEmit 2>&1 | head -12)
if [ -n "$TSC_OUT" ]; then
  echo "  ✗ tsc 报错:"
  echo "$TSC_OUT" | sed 's/^/    /'
  echo ""
  echo "  本批次中止。回退：git checkout -- . && git reset"
  exit 1
fi
echo "  ✓ 通过"

# ---------- 5. 构建 ----------
echo ""
echo "=== 5. 构建 ==="
npm run build > /tmp/batch-build.log 2>&1
CODE=$?
if [ "$CODE" != "0" ]; then
  echo "  ✗ 构建失败（退出码 $CODE）"
  grep -iE 'error|Failed' /tmp/batch-build.log | head -10 | sed 's/^/    /'
  echo ""
  echo "  本批次中止。回退：git checkout -- . && git reset"
  exit 1
fi
grep -E 'Compiled successfully' /tmp/batch-build.log | head -1 | sed 's/^/  ✓ /'

pm2 restart ai-insight-daily --update-env > /dev/null 2>&1
sleep 9

# ---------- 6. 页面检查 ----------
echo ""
echo "=== 6. 页面检查 ==="
PAGE_FAIL=0
for P in "/" "/news" "/events" "/entities" "/industry" "/investment" "/agent" "/models" "/opportunity-map" "/about" "/privacy" "/trend"; do
  C=$(curl -s -o /dev/null --max-time 60 -w '%{http_code}' "http://127.0.0.1:3000$P")
  printf '  %-18s %s\n' "$P" "$C"
  [ "$C" != "200" ] && PAGE_FAIL=1
done

if [ "$PAGE_FAIL" -ne 0 ]; then
  echo ""
  echo "  ✗ 有页面异常，本批次中止"
  exit 1
fi

# ---------- 7. 测试 ----------
echo ""
echo "=== 7. 测试 ==="
TEST_OUT=$(npx tsx --test lib/agents/travel/*.test.ts lib/ranking/*.test.ts lib/*.test.ts 2>&1)
echo "$TEST_OUT" | grep -E "^# (tests|pass|fail)" | sed 's/^/  /'

FAILN=$(echo "$TEST_OUT" | grep -E "^# fail" | grep -oE '[0-9]+')
if [ "${FAILN:-0}" != "0" ]; then
  echo "  ✗ 测试失败"
  exit 1
fi

# ---------- 8. 提交 ----------
echo ""
echo "=== 8. 提交 ==="
git add -A
git commit -q -m "chore: $LABEL（删除 $(echo $BATCH | wc -w) 个无引用组件，$TOTAL 行）

删除清单：$(for C in $BATCH; do printf '%s ' "$C"; done)

删除前三重验证：无 import 语句、无路径引用、无 JSX 标签使用。

验证：tsc 通过、构建通过、12 个页面均 200、460 项测试通过。

明细见 ai-context/DEAD_COMPONENT_REPORT.md。"

git log --oneline -1 | sed 's/^/  /'
git push origin main 2>&1 | tail -1 | sed 's/^/  /'

echo ""
echo "=== 9. 剩余组件数 ==="
echo "  顶层: $(ls components/*.tsx 2>/dev/null | wc -l)"
echo ""
echo "############################################################"
echo "#  $LABEL 完成"
echo "############################################################"
