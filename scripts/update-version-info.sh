#!/bin/bash
#
# 检查并更新 ai-context/AI_VERSION_INFO.md 的版本标记。
#
# 设计说明（2026-10-16，第三版）
#
# 前两版都记录 commit 哈希，都失败了：
#
#   第一版：比较标记与 HEAD → 永远落后 1。
#           因为「更新标记」这个动作本身就是一次提交，提交后 HEAD 前移，
#           标记随即过时。
#
#   第二版：排除「只改标记文件」的提交 → 需逐个提交遍历文件清单，
#           逻辑复杂；更糟的是在文档与脚本两份拷贝之间反复同步时，
#           修复本身被覆盖丢失，表现为问题反复出现。
#
# 第三版：不记哈希，记日期。
#
#   日期没有自指问题：「代码状态日期」写进文件后，提交它不会改变该日期。
#
#   判断方式：找出最近一次「改动了标记文件之外内容」的提交日期，
#   与标记记录的日期比较。若代码的日期更新，说明标记过时。
#
# 用法：
#   bash scripts/update-version-info.sh          更新
#   bash scripts/update-version-info.sh --check  只检查，退出码非 0 表示过时

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
DOC_REL="ai-context/AI_VERSION_INFO.md"
DOC="$PROJECT_DIR/$DOC_REL"

START_MARK="<!-- AUTO-UPDATE-START -->"
END_MARK="<!-- AUTO-UPDATE-END -->"

MODE="${1:-update}"

# ---------- 前置检查 ----------
if [ ! -f "$DOC" ]; then
  echo "✗ 找不到 $DOC"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "✗ 当前目录不是 git 仓库"
  exit 1
fi

# ---------- 读取标记里记录的日期 ----------
#
# 兼容多种字段标签，避免文档与脚本处于不同版本时报错。
RECORDED_DATE=$(sed -n "/$START_MARK/,/$END_MARK/p" "$DOC" \
  | awk -F'|' '/代码状态日期|状态日期|commit 日期/ {gsub(/ /, "", $3); print $3; exit}')

if [ -z "$RECORDED_DATE" ]; then
  echo "✗ 文档中未找到日期标记，请确认 $START_MARK 与 $END_MARK 成对存在"
  exit 1
fi

# ---------- 找出最近一次「改动了标记文件之外内容」的提交 ----------
#
# 这是判断依据：只有真正改了代码或文档的提交才算「代码前进」。
# 交接包 zip 是 update-ai-handover.sh 的产物，完全由仓库内容重建，
# 同样不代表代码前进，一并跳过。
CODE_COMMIT=""
CODE_DATE=""

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

if [ -z "$CODE_COMMIT" ]; then
  echo "✗ 无法确定代码提交（最近 50 个提交都只涉及标记文件）"
  exit 1
fi

CURRENT_HEAD=$(git rev-parse --short HEAD)

is_synced() {
  [ "$RECORDED_DATE" \> "$CODE_DATE" ] || [ "$RECORDED_DATE" = "$CODE_DATE" ]
}

# ---------- --check 模式 ----------
if [ "$MODE" = "--check" ]; then
  echo "=============================="
  echo "版本信息检查"
  echo "=============================="
  echo ""
  echo "  标记记录的代码状态日期: $RECORDED_DATE"
  echo "  最近的真实代码改动:     $CODE_DATE（$CODE_COMMIT）"
  echo "  当前 HEAD:              $CURRENT_HEAD"
  echo ""

  if is_synced; then
    echo "  ✓ 文档与代码同步"
    exit 0
  fi

  echo "  ⚠ 文档已过时：代码在 $CODE_DATE 有改动，标记停在 $RECORDED_DATE"
  echo ""
  echo "  运行以下命令更新："
  echo "      bash scripts/update-version-info.sh"
  echo ""
  echo "  标记之后的提交："
  git log --oneline -10 2>/dev/null | sed 's/^/    /'

  exit 1
fi

# ---------- 更新模式 ----------
if is_synced; then
  echo "  文档已是最新（标记 $RECORDED_DATE，代码 $CODE_DATE），无需更新"
  exit 0
fi

NOW=$(date '+%Y-%m-%d %H:%M:%S')

TMP=$(mktemp)

awk -v start="$START_MARK" -v end="$END_MARK" \
    -v cdate="$CODE_DATE" -v commit="$CODE_COMMIT" -v now="$NOW" '
  $0 == start {
    print start
    print "| 代码状态日期 | " cdate " |"
    print "| 对应提交 | " commit " |"
    print "| 本文档更新于 | " now " |"
    skip = 1
    next
  }
  $0 == end { skip = 0 }
  !skip { print }
' "$DOC" > "$TMP"

if [ ! -s "$TMP" ]; then
  echo "✗ 生成的新内容为空，已放弃（原文件未改动）"
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$DOC"

echo "=============================="
echo "版本信息已更新"
echo "=============================="
echo ""
echo "  $RECORDED_DATE → $CODE_DATE（对应提交 $CODE_COMMIT）"
echo "  更新时间: $NOW"
