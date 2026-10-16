#!/bin/bash
#
# 记录并检查交接包的版本状态。
#
# 设计说明（第四版，最终）
#
# 前三版都想做「精确判断文档落后代码多少个提交」，都失败了：
#
#   第一版 比较标记与 HEAD
#          → 永远落后 1。更新标记本身就是一次提交。
#
#   第二版 排除「只改标记文件」的提交
#          → 逻辑复杂；且在文档与脚本两份拷贝间反复同步时，
#            修复本身被覆盖丢失，问题反复出现。
#
#   第三版 改记日期不记哈希
#          → 同一天内的多次提交无法区分，「今天改了三处代码」
#            与「今天只更新了标记」看起来一样。
#
# 共同的问题：把一个自指的、需要精确性的判断塞进文件内容里，
# 而文件内容本身又是被判断对象的一部分。
#
# 第四版改变目标：不做精确判断，只做记录与粗粒度提示。
#
#   · 记录「最近一次代码改动的日期」与「当时的最新提交」
#   · 检查时只回答：代码在标记日期之后有没有改动过
#   · 同日多次改动不追求区分 —— 那种精度对实际使用没有价值，
#     真正需要的是「这份交接包是不是几周前的旧货」
#
# 用法：
#   bash scripts/update-version-info.sh          更新记录
#   bash scripts/update-version-info.sh --check  查看是否落后

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
DOC_REL="ai-context/AI_VERSION_INFO.md"
DOC="$PROJECT_DIR/$DOC_REL"

START_MARK="<!-- AUTO-UPDATE-START -->"
END_MARK="<!-- AUTO-UPDATE-END -->"

MODE="${1:-update}"

if [ ! -f "$DOC" ]; then
  echo "✗ 找不到 $DOC"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

# ---------- 读取标记 ----------
RECORDED_DATE=$(sed -n "/$START_MARK/,/$END_MARK/p" "$DOC" \
  | awk -F'|' '/代码状态日期/ {gsub(/ /, "", $3); print $3; exit}')

if [ -z "$RECORDED_DATE" ]; then
  echo "✗ 文档中未找到「代码状态日期」标记"
  echo "  请确认 $START_MARK 与 $END_MARK 之间存在该字段"
  exit 1
fi

# ---------- 最近一次真实代码改动的日期 ----------
#
# 跳过只涉及标记文件与交接包 zip 的提交（两者都是生成物）。
CODE_DATE=""
CODE_COMMIT=""

while IFS= read -r sha; do
  [ -z "$sha" ] && continue

  for f in $(git show --pretty=format: --name-only "$sha" 2>/dev/null); do
    [ -z "$f" ] && continue

    if [ "$f" != "$DOC_REL" ] && [ "$f" != "AI-HANDOVER.zip" ]; then
      CODE_COMMIT="$sha"
      CODE_DATE=$(git log -1 --format=%cd --date=short "$sha" 2>/dev/null)
      break
    fi
  done

  [ -n "$CODE_COMMIT" ] && break
done < <(git log --format='%h' -50 2>/dev/null)

if [ -z "$CODE_DATE" ]; then
  echo "✗ 无法确定代码改动日期"
  exit 1
fi

TODAY=$(date '+%Y-%m-%d')

# ---------- --check ----------
if [ "$MODE" = "--check" ]; then
  echo "=============================="
  echo "交接包版本检查"
  echo "=============================="
  echo ""
  echo "  标记记录的代码状态日期: $RECORDED_DATE"
  echo "  最近一次代码改动:       $CODE_DATE（$CODE_COMMIT）"
  echo ""

  if [ "$RECORDED_DATE" = "$CODE_DATE" ]; then
    echo "  ✓ 交接包记录与代码同步（同为 $CODE_DATE）"

    if [ "$CODE_DATE" = "$TODAY" ] && [ "$CODE_COMMIT" != "$(git rev-parse --short HEAD)" ]; then
      echo ""
      echo "  提示：代码在今天有多次改动。若刚完成较大开发，"
      echo "        建议重新生成交接包：bash update-ai-handover.sh"
    fi

    exit 0
  fi

  if [ "$RECORDED_DATE" \< "$CODE_DATE" ]; then
    echo "  ⚠ 交接包已过时：代码在 $CODE_DATE 有改动，记录停在 $RECORDED_DATE"
    echo ""
    echo "  建议执行："
    echo "      bash update-ai-handover.sh            重新生成交接包"
    echo "      bash scripts/update-version-info.sh   更新记录"
    exit 1
  fi

  echo "  ✓ 记录日期不早于代码改动日期"
  exit 0
fi

# ---------- 更新 ----------
if [ "$RECORDED_DATE" = "$CODE_DATE" ]; then
  echo "  记录已是最新（$CODE_DATE），无需更新"
  exit 0
fi

NOW=$(date '+%Y-%m-%d %H:%M:%S')
TMP=$(mktemp)

awk -v start="$START_MARK" -v end="$END_MARK" \
    -v cdate="$CODE_DATE" -v commit="$CODE_COMMIT" -v now="$NOW" '
  $0 == start {
    print start
    print "| 代码状态日期 | " cdate " |"
    print "| 当时最新提交 | " commit " |"
    print "| 本记录更新于 | " now " |"
    skip = 1
    next
  }
  $0 == end { skip = 0 }
  !skip { print }
' "$DOC" > "$TMP"

if [ ! -s "$TMP" ]; then
  echo "✗ 生成内容为空，已放弃"
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$DOC"

echo "=============================="
echo "版本记录已更新"
echo "=============================="
echo ""
echo "  $RECORDED_DATE → $CODE_DATE"
echo "  当时最新提交: $CODE_COMMIT"
echo ""
echo "  提交这个文件即可："
echo "      git add $DOC_REL && git commit -m 'docs: 更新交接包版本记录'"
