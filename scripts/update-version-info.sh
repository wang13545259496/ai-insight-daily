#!/bin/bash
#
# 更新 ai-context/AI_VERSION_INFO.md 中的版本标记。
#
# 为什么需要它：
# 那份文档记录「交接包对应哪个 commit」。手工维护时，
# 它停在 2026-10-11 的 8a778c8，而代码已经推进了 100 多个提交 ——
# 没人会记得每次改完都去更新一个文档里的哈希值。
#
# 做法：在文档里放一对标记，脚本只替换标记之间的内容。
# 这样既能自动更新，又不影响文档其余部分的正常编辑。
#
# 用法：
#   bash scripts/update-version-info.sh          更新
#   bash scripts/update-version-info.sh --check  只检查是否落后，不写入

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
DOC="$PROJECT_DIR/ai-context/AI_VERSION_INFO.md"

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

# ---------- 收集当前版本信息 ----------
COMMIT=$(git rev-parse --short HEAD)
COMMIT_DATE=$(git log -1 --format=%cd --date=short)
NOW=$(date '+%Y-%m-%d %H:%M:%S')

# ---------- 读取文档里记录的代码状态 ----------
#
# 同时接受两种字段标签：
#   「记录的代码状态」（当前）与「项目 commit」（旧版）。
#
# 为什么要兼容旧标签：这个字段名改过一次，而文档与脚本是分开维护的，
# 改标签时若只改了一边，脚本就会报「未找到版本标记」。
# 实际发生过一次，排查花了不少时间。兼容两种写法后，
# 无论文档处于哪个版本都能正常读取。
#
# 用 awk 按 | 分列取值。
# 不用 sed 's/.*| *//' —— .* 是贪婪的，会一路匹配到本行最后一个 |，
# 导致提取结果为空（这个坑也实际踩过）。
RECORDED=$(sed -n "/$START_MARK/,/$END_MARK/p" "$DOC" \
  | awk -F'|' '/记录的代码状态|commit/ && !/AUTO-UPDATE/ {gsub(/ /, "", $3); print $3; exit}')

if [ -z "$RECORDED" ]; then
  echo "✗ 文档中未找到版本标记，请确认 $START_MARK 与 $END_MARK 成对存在"
  exit 1
fi

# ---------- 计算落后多少 ----------
BEHIND=$(git rev-list --count "$RECORDED..HEAD" 2>/dev/null || echo "?")

# ---------- --check 模式：只报告 ----------
if [ "$MODE" = "--check" ]; then
  echo "=============================="
  echo "版本信息检查"
  echo "=============================="
  echo ""
  echo "  文档记录的 commit: $RECORDED"
  echo "  当前 HEAD:         $COMMIT（$COMMIT_DATE）"

  if [ "$BEHIND" = "0" ]; then
    echo ""
    echo "  ✓ 文档与代码同步"
    exit 0
  fi

  echo "  落后:              $BEHIND 个提交"
  echo ""
  echo "  ⚠ 文档已过时。运行以下命令更新："
  echo "      bash scripts/update-version-info.sh"
  echo ""
  echo "  落后的提交："
  git log --oneline "$RECORDED..HEAD" 2>/dev/null | head -10 | sed 's/^/    /'
  exit 1
fi

# ---------- 更新模式 ----------
if [ "$BEHIND" = "0" ]; then
  echo "  文档已是最新（$COMMIT），无需更新"
  exit 0
fi

# 用临时文件替换标记之间的内容
TMP=$(mktemp)

awk -v start="$START_MARK" -v end="$END_MARK" \
    -v commit="$COMMIT" -v cdate="$COMMIT_DATE" -v now="$NOW" '
  $0 == start {
    print start
    print "| 项目 commit | " commit " |"
    print "| commit 日期 | " cdate " |"
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
echo "  $RECORDED → $COMMIT（推进 $BEHIND 个提交）"
echo "  更新时间: $NOW"
echo ""
echo "  提示：提交这次变更"
echo "      git add ai-context/AI_VERSION_INFO.md && git commit -m 'docs: 更新交接包版本标记到 $COMMIT'"
