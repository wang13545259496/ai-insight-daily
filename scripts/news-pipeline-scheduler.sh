#!/bin/bash
#
# 新闻采集调度：每小时整点采集一次，配合开机补跑。
#
# 目标：尽可能是最新资讯。
#
# 为什么阈值是 50 分钟而不是 60：
#   marker 在管线**跑完之后**才写入，而 cron 在整点触发。
#   一次管线实测约 90 秒（积压多时可达 6 分钟）。
#
#     00:00:00  cron 触发
#     00:01:30  管线完成，写入 marker
#     01:00:00  cron 再次触发
#              距 marker 仅 58.5 分钟
#
#   若阈值是严格的 60 分钟，此时判定「不足」而跳过 ——
#   实际间隔变成 2 小时，且随管线耗时波动在 1/2 小时之间抖动。
#   取 50 分钟留 10 分钟余量，效果是每个整点都会采一次。
#
# 成本说明：
#   流水线里只有「新闻分析」调 AI，事件聚类 / 关联 / 评分 / 趋势
#   都是规则计算。费用取决于新入库多少条，而不是跑多少轮 ——
#   没有新新闻时跑一轮几乎不花钱。
#
# 并发保护：用 flock。若上一轮还没跑完就跳过，
# 避免两个进程同时抓取、重复导入。

set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKER="$HOME/.last-news-pipeline"
LOCK="/tmp/news-pipeline.lock"
LOG="$PROJECT_DIR/logs/news-pipeline.log"
ALERT="$PROJECT_DIR/scripts/alert.sh"

# 距上次采集超过这个分钟数就采（见文件头为什么是 50 而非 60）
MAX_AGE_MINUTES=50

# 管线最长允许跑多久。
# 并发 6，实测约 3 秒/条；单轮最多分析 120 条约 370 秒，留足余量。
TIMEOUT_SEC=900

mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# ---------- 并发保护 ----------
exec 9>"$LOCK"
if ! flock -n 9; then
  log "跳过：已有采集进程在运行"
  exit 0
fi

# ---------- 判断是否需要采集 ----------
if [ -f "$MARKER" ]; then
  LAST=$(tr -d '[:space:]' < "$MARKER" 2>/dev/null)

  if [ -n "$LAST" ] && [ "$LAST" -eq "$LAST" ] 2>/dev/null; then
    AGE_MINUTES=$(( ($(date +%s) - LAST) / 60 ))

    if [ "$AGE_MINUTES" -lt "$MAX_AGE_MINUTES" ]; then
      log "跳过：距上次采集 $AGE_MINUTES 分钟（阈值 $MAX_AGE_MINUTES）"
      exit 0
    fi

    log "距上次采集 $AGE_MINUTES 分钟，开始执行"
  fi
else
  # 兼容按日期记录的 marker（某一版曾用过 ~/.last-news-pipeline-date）
  DATE_MARKER="$HOME/.last-news-pipeline-date"

  if [ -f "$DATE_MARKER" ] && [ "$(tr -d '[:space:]' < "$DATE_MARKER")" = "$(date +%Y-%m-%d)" ]; then
    # 今天按日期采过但不知具体时刻 —— 保守地按阈值前起算
    echo $(( $(date +%s) - MAX_AGE_MINUTES * 60 )) > "$MARKER"
    log "从日期 marker 迁移：今天已采集过，按 $MAX_AGE_MINUTES 分钟前起算"
  else
    log "无采集记录，开始执行"
  fi
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

date +%s > "$MARKER"

if [ "${IMPORTED:-0}" = "0" ]; then
  log "注意：本轮未导入新新闻（可能全部重复）"
fi

exit 0
