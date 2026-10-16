#!/bin/bash
#
# 数据库备份调度：定时执行 + 开机补跑。
#
# 为什么需要这个包装脚本：
# 原先的 cron 定在凌晨 3 点，但那台机器的活跃时段是 8-23 点，
# 凌晨基本处于关机状态 —— 结果 10 天里只成功备份过 1 次。
# cron 不会补跑错过的任务，所以固定时间点本身就不适合这台机器。
#
# 做法：
#   · 由 cron 在活跃时段触发（23:00）
#   · @reboot 时也触发一次
#   · 本脚本先判断"距上次成功备份是否超过 N 小时"，只有超时才真正执行
#     —— 于是无论触发多少次，实际备份频率都稳定在每天一次左右

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
MARKER="$HOME/.last-db-backup"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup-db-to-github.sh"
LOG="$PROJECT_DIR/logs/db-backup.log"

# 超过这个小时数就备份（设为 20 小时，保证每天至少一次，
# 又不会因为多触发几次就重复推送）
MAX_AGE_HOURS=20

mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# ---------- 判断是否需要备份 ----------
NEED=1

if [ -f "$MARKER" ]; then
  LAST=$(cat "$MARKER" 2>/dev/null | tr -d '[:space:]')

  if [ -n "$LAST" ] && [ "$LAST" -eq "$LAST" ] 2>/dev/null; then
    NOW=$(date +%s)
    AGE_HOURS=$(( (NOW - LAST) / 3600 ))

    if [ "$AGE_HOURS" -lt "$MAX_AGE_HOURS" ]; then
      NEED=0
      log "跳过：距上次备份仅 $AGE_HOURS 小时（阈值 $MAX_AGE_HOURS）"
    else
      log "距上次备份 $AGE_HOURS 小时，开始执行"
    fi
  fi
else
  log "无备份记录，开始执行"
fi

if [ "$NEED" = "0" ]; then
  exit 0
fi

# ---------- 执行备份 ----------
if [ ! -x "$BACKUP_SCRIPT" ]; then
  log "✗ 备份脚本不存在或不可执行: $BACKUP_SCRIPT"
  exit 1
fi

OUTPUT=$(bash "$BACKUP_SCRIPT" 2>&1)
CODE=$?

echo "$OUTPUT" >> "$LOG"

if [ "$CODE" = "0" ]; then
  date +%s > "$MARKER"
  log "✓ 备份成功"
else
  log "✗ 备份失败（退出码 $CODE）"
fi

exit $CODE
