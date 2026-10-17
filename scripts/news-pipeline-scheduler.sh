#!/bin/bash
#
# 新闻采集调度：开机 10 分钟后触发，每天只采集一次。
#
# 为什么用「日历日」而不是「间隔小时数」：
#   维护者要求「每天只采集一次」。用小时数（比如 >20h）会在
#   跨天时间点漂移 —— 今天 9:10 跑，明天可能变成 5:10 或 22:10。
#   用日期判断则严格保证：同一天无论触发多少次，最多采集一次。
#
# 触发方式（两条 crontab 协同）：
#   @reboot sleep 600   → 开机 10 分钟后，主触发
#   5 * * * *           → 兜底，覆盖「连续多天不关机」的情况
#
#   兜底那条不会导致一天采集两次 —— 进入脚本后先查日期，
#   今天已经采过就直接退出（耗时不到 1 秒）。
#   若维护者能保证每天关机，可以把兜底那条删掉，只留 @reboot。
#
# 并发保护：用 flock。管线一次约 90 秒，若上一轮还没跑完就跳过，
# 避免两个进程同时抓取、重复导入。

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
MARKER="$HOME/.last-news-pipeline-date"
OLD_MARKER="$HOME/.last-news-pipeline"
LOCK="/tmp/news-pipeline.lock"
LOG="$PROJECT_DIR/logs/news-pipeline.log"
ALERT="$PROJECT_DIR/scripts/alert.sh"

# 管线最长允许跑多久。
# 并发 6，实测约 3 秒/条；单轮最多分析 120 条 ≈ 370 秒，留足余量。
TIMEOUT_SEC=900

mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# ---------- 并发保护 ----------
exec 9>"$LOCK"
if ! flock -n 9; then
  log "跳过：已有采集进程在运行"
  exit 0
fi

# ---------- 今天是否已采集 ----------
TODAY=$(date +%Y-%m-%d)

if [ -f "$MARKER" ]; then
  LAST=$(tr -d '[:space:]' < "$MARKER" 2>/dev/null)

  if [ "$LAST" = "$TODAY" ]; then
    log "跳过：今天（$TODAY）已采集过"
    exit 0
  fi

  log "上次采集 $LAST，今天是 $TODAY，开始执行"
else
  # 兼容旧版按时间戳记录的 marker：从时间戳推算出日期，
  # 避免升级当天立刻重复采集一次。
  if [ -f "$OLD_MARKER" ]; then
    OLD_TS=$(tr -d '[:space:]' < "$OLD_MARKER" 2>/dev/null)

    if [ -n "$OLD_TS" ] && [ "$OLD_TS" -eq "$OLD_TS" ] 2>/dev/null; then
      OLD_DATE=$(date -d "@$OLD_TS" +%Y-%m-%d 2>/dev/null)

      if [ "$OLD_DATE" = "$TODAY" ]; then
        echo "$TODAY" > "$MARKER"
        log "沿用旧记录：今天（$TODAY）已采集过，迁移 marker 后跳过"
        exit 0
      fi
    fi
  fi

  log "今天（$TODAY）尚未采集，开始执行"
fi

# ---------- 取值 ----------
if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  log "✗ .env.local 不存在，无法读取 CRON_SECRET"
  exit 1
fi

CRON_SECRET=$(grep '^CRON_SECRET=' "$PROJECT_DIR/.env.local" 2>/dev/null | cut -d= -f2- | tr -d '\r' | tr -d '"')

if [ -z "$CRON_SECRET" ]; then
  log "✗ .env.local 里没有 CRON_SECRET"
  bash "$ALERT" "采集失败" "无法读取 CRON_SECRET，管线未执行" 2>/dev/null
  exit 1
fi

# ---------- 先确认应用在线 ----------
APP_CODE=$(curl -s -o /dev/null -m 15 -w '%{http_code}' http://127.0.0.1:3000/ 2>/dev/null)

if [ "$APP_CODE" != "200" ]; then
  log "✗ 应用未就绪（本地 HTTP $APP_CODE），跳过本轮"
  # 不告警：应用离线由 health-monitor.sh 负责，避免重复通知
  exit 1
fi

# ---------- 执行 ----------
log "调用 /api/cron/daily ..."

RESP=$(curl -s -m "$TIMEOUT_SEC" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -w '\n__HTTP__%{http_code}' \
  http://127.0.0.1:3000/api/cron/daily 2>&1)

CODE=$(printf '%s' "$RESP" | tail -1 | sed 's/^__HTTP__//')
BODY=$(printf '%s' "$RESP" | sed '$d')

if [ "$CODE" != "200" ]; then
  log "✗ 管线失败（HTTP $CODE）"
  log "响应：$(printf '%s' "$BODY" | head -c 500)"
  bash "$ALERT" "新闻采集失败" "HTTP $CODE
$(printf '%s' "$BODY" | head -c 400)" 2>/dev/null
  exit 1
fi

# ---------- 解析结果 ----------
IMPORTED=$(printf '%s' "$BODY" | grep -oE '"imported":[0-9]+' | head -1 | cut -d: -f2)
ANALYZED=$(printf '%s' "$BODY" | grep -oE '"analyzed":[0-9]+' | head -1 | cut -d: -f2)
EVENTS=$(printf '%s' "$BODY" | grep -oE '"events":[0-9]+' | head -1 | cut -d: -f2)
DURATION=$(printf '%s' "$BODY" | grep -oE '"duration":[0-9]+' | head -1 | cut -d: -f2)

log "✓ 成功：导入 ${IMPORTED:-?} 条，分析 ${ANALYZED:-?} 条，事件 ${EVENTS:-?} 个，耗时 $(( ${DURATION:-0} / 1000 )) 秒"

echo "$TODAY" > "$MARKER"

if [ "${IMPORTED:-0}" = "0" ]; then
  log "注意：本轮未导入新新闻（可能全部重复）"
fi

exit 0
