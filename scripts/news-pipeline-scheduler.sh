#!/bin/bash
#
# 新闻采集调度：定时触发 + 开机补跑 + 陈旧度判断。
#
# 为什么需要这个包装脚本（与 db-backup-scheduler.sh 同一思路）：
# 原先 cron 定在凌晨 2 点直接调 /api/cron/daily，但——
#   · 这台机器不是 24 小时开机（活跃时段大致 8-23 点）
#   · cron 不补跑错过的任务
# 结果：logs/daily-cron.log 从未生成，内容停在 47 小时前。
#
# 做法：
#   · cron 每小时触发一次
#   · @reboot 时也触发
#   · 本脚本先判断「距上次成功采集是否超过 N 小时」，只有超时才真正执行
#     —— 于是无论触发多少次，实际频率都稳定在每 N 小时一次
#
# 并发保护：用 flock。管线一次约 90 秒，若上一轮还没跑完就跳过，
# 避免两个进程同时抓取、重复导入。

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
MARKER="$HOME/.last-news-pipeline"
LOCK="/tmp/news-pipeline.lock"
LOG="$PROJECT_DIR/logs/news-pipeline.log"
ALERT="$PROJECT_DIR/scripts/alert.sh"

# 超过这个小时数就采集。
# 6 小时 = 每天至少 2-4 次（取决于机器在线时长）。
# 新闻站对新鲜度敏感，但又不能太频繁（每次会消耗 DeepSeek 额度）。
MAX_AGE_HOURS=6

# 管线最长允许跑多久（实测约 90 秒，留足余量）
TIMEOUT_SEC=300

mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# ---------- 并发保护 ----------
exec 9>"$LOCK"
if ! flock -n 9; then
  log "跳过：已有采集进程在运行"
  exit 0
fi

# ---------- 判断是否需要采集 ----------
NEED=1
AGE_HOURS=-1

if [ -f "$MARKER" ]; then
  LAST=$(tr -d '[:space:]' < "$MARKER" 2>/dev/null)

  if [ -n "$LAST" ] && [ "$LAST" -eq "$LAST" ] 2>/dev/null; then
    AGE_HOURS=$(( ($(date +%s) - LAST) / 3600 ))

    if [ "$AGE_HOURS" -lt "$MAX_AGE_HOURS" ]; then
      log "跳过：距上次采集 $AGE_HOURS 小时（阈值 $MAX_AGE_HOURS）"
      exit 0
    fi

    log "距上次采集 $AGE_HOURS 小时，开始执行"
  fi
else
  log "无采集记录，开始执行"
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
# 响应形如：
# {"success":true,"data":{"rss":{"imported":93,...},"analysis":{"analyzed":30,...},...}}
IMPORTED=$(printf '%s' "$BODY" | grep -oE '"imported":[0-9]+' | head -1 | cut -d: -f2)
ANALYZED=$(printf '%s' "$BODY" | grep -oE '"analyzed":[0-9]+' | head -1 | cut -d: -f2)
EVENTS=$(printf '%s' "$BODY" | grep -oE '"events":[0-9]+' | head -1 | cut -d: -f2)
DURATION=$(printf '%s' "$BODY" | grep -oE '"duration":[0-9]+' | head -1 | cut -d: -f2)

log "✓ 成功：导入 ${IMPORTED:-?} 条，分析 ${ANALYZED:-?} 条，事件 ${EVENTS:-?} 个，耗时 $(( ${DURATION:-0} / 1000 )) 秒"

date +%s > "$MARKER"

# 若成功但一条都没导入，值得提一句（可能全部重复，也可能抓取异常）
if [ "${IMPORTED:-0}" = "0" ]; then
  log "注意：本轮未导入新新闻（可能全部重复）"
fi

exit 0
