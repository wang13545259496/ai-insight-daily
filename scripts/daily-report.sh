#!/bin/bash
#
# 每日 AI 用量与成本报告：生成后推送到微信。
#
# 为什么要做成定时任务而不是「等 AI 助手明天来跑」：
#   AI 助手只在对话进行时存在，会话结束后不会自己醒来。
#   把这件事交给 cron，才是真的每天都会发生。
#
# 触发方式：
#   30 22 * * *   每天 22:30 推送当天报告
#   @reboot       开机时补发昨天漏掉的报告
#
# 为什么是 22:30：
#   这台机器不是 24 小时开机，活跃时段大致 8-23 点。
#   22:30 落在活跃时段内，且当天数据已基本完整。
#
# 为什么 @reboot 发的是昨天：
#   开机时当天才刚开始，当天的报告没有意义。
#   而有价值的是「昨天关机前没发出去的那份」。

set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKER="$HOME/.last-daily-report"
LOG="$PROJECT_DIR/logs/daily-report.log"
ALERT="$PROJECT_DIR/scripts/alert.sh"
REPORT="$PROJECT_DIR/scripts/ai-usage-report.sh"

mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

MODE="${1:-scheduled}"

# ---------- 决定要报告哪一天 ----------
if [ "$MODE" = "catchup" ]; then
  # 开机补发：只关心昨天
  TARGET=$(date -d 'yesterday' '+%Y-%m-%d')
else
  TARGET=$(date '+%Y-%m-%d')
fi

# ---------- 是否已经发过 ----------
if [ -f "$MARKER" ]; then
  LAST=$(tr -d '[:space:]' < "$MARKER" 2>/dev/null)

  if [ "$LAST" = "$TARGET" ]; then
    log "$TARGET 的报告已发过，跳过"
    exit 0
  fi
fi

# ---------- 生成报告 ----------
if [ ! -x "$REPORT" ]; then
  log "✗ 报告脚本不存在或不可执行：$REPORT"
  exit 1
fi

BODY=$(bash "$REPORT" "$TARGET" 2>&1)

if [ -z "$BODY" ]; then
  log "✗ 报告生成失败（输出为空）"
  exit 1
fi

log "已生成 $TARGET 的报告（$(printf '%s' "$BODY" | wc -l) 行）"

# ---------- 推送 ----------
# 控制长度：Server 酱对正文有长度限制，过长会被截断或拒绝。
# 只取核心数字，不把整份报告塞进去。
SUMMARY=$(printf '%s' "$BODY" | grep -E '采集轮次|入库新闻|完成分析|AI 调用|输入 token|输出 token|估算成本|当前余额' | sed 's/^ *//')

if [ -z "$SUMMARY" ]; then
  SUMMARY=$(printf '%s' "$BODY" | head -25)
fi

TITLE="AI站点日报 $TARGET"

if bash "$ALERT" "$TITLE" "$SUMMARY" 2>/dev/null; then
  echo "$TARGET" > "$MARKER"
  log "✓ 已推送 $TARGET 的报告"
else
  log "✗ 推送失败，保留 marker 以便下次重试"
  exit 1
fi

exit 0
