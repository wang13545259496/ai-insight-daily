#!/bin/bash
#
# 告警分发。
#
# 设计考虑：
#
# 1. **不绑定单一渠道**。维护者换通知方式时不必改调用方。
#    支持三种：
#      ALERT_WEBHOOK_URL   通用 webhook（POST JSON），适配 Slack/Discord/
#                          Telegram Bot API/自建服务
#      SERVERCHAN_KEY      Server 酱（国内常用，微信推送）
#      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
#
# 2. **未配置不算失败**。没有通知渠道时写日志并正常退出，
#    避免把「没配告警」变成「监控脚本报错」这种二次噪音。
#
# 3. **始终写本地日志**。即使推送成功也记录，
#    便于事后核对「什么时候报过什么」。
#
# 用法：
#   bash scripts/alert.sh "标题" "正文"
#   bash scripts/alert.sh "站点不可用" "https://aibiliai.com 连续 3 次失败"
#
# 退出码：
#   0  已推送或已记录（未配置渠道时也是 0）
#   1  配置了渠道但推送失败

set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$PROJECT_DIR/logs/alert.log"

TITLE="${1:-告警}"
BODY="${2:-}"

mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# ---------- 读取配置 ----------
# 优先 .env.local，其次 ~/.alert-config（便于不把密钥写进仓库）
CFG=""

if [ -f "$PROJECT_DIR/.env.local" ]; then
  CFG=$(grep -E '^(ALERT_WEBHOOK_URL|SERVERCHAN_KEY|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=' \
    "$PROJECT_DIR/.env.local" 2>/dev/null)
fi

if [ -f "$HOME/.alert-config" ]; then
  CFG="$CFG
$(grep -E '^(ALERT_WEBHOOK_URL|SERVERCHAN_KEY|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=' \
    "$HOME/.alert-config" 2>/dev/null)"
fi

get() { echo "$CFG" | grep -E "^$1=" | tail -1 | cut -d= -f2- | tr -d '\r' | tr -d '"'; }

WEBHOOK=$(get ALERT_WEBHOOK_URL)
SCKEY=$(get SERVERCHAN_KEY)
TG_TOKEN=$(get TELEGRAM_BOT_TOKEN)
TG_CHAT=$(get TELEGRAM_CHAT_ID)

HOSTNAME_SHORT=$(hostname 2>/dev/null || echo "unknown")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

FULL_TEXT="[$HOSTNAME_SHORT] $TITLE
$BODY
时间：$TIMESTAMP"

log "告警：$TITLE | $BODY"

# ---------- 无渠道：记录后正常退出 ----------
if [ -z "$WEBHOOK" ] && [ -z "$SCKEY" ] && [ -z "$TG_TOKEN" ]; then
  log "（未配置通知渠道，仅记录本地日志）"
  exit 0
fi

SENT=0
FAILED=0

# ---------- Server 酱 ----------
if [ -n "$SCKEY" ]; then
  SC_URL="https://sctapi.ftqq.com/${SCKEY}.send"

  # 正文用 --data-urlencode，避免中文与换行导致签名错误
  RESP=$(curl -s --max-time 15 "$SC_URL" \
    --data-urlencode "title=$HOSTNAME_SHORT $TITLE" \
    --data-urlencode "desp=$FULL_TEXT" 2>&1)

  if echo "$RESP" | grep -q '"code":0'; then
    log "✓ Server酱推送成功"
    SENT=$((SENT+1))
  else
    log "✗ Server酱推送失败：$(echo "$RESP" | head -c 200)"
    FAILED=$((FAILED+1))
  fi
fi

# ---------- Telegram ----------
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  TG_URL="https://api.telegram.org/bot${TG_TOKEN}/sendMessage"

  RESP=$(curl -s --max-time 15 "$TG_URL" \
    --data-urlencode "chat_id=$TG_CHAT" \
    --data-urlencode "text=$FULL_TEXT" 2>&1)

  if echo "$RESP" | grep -q '"ok":true'; then
    log "✓ Telegram 推送成功"
    SENT=$((SENT+1))
  else
    log "✗ Telegram 推送失败：$(echo "$RESP" | head -c 200)"
    FAILED=$((FAILED+1))
  fi
fi

# ---------- 通用 webhook ----------
if [ -n "$WEBHOOK" ]; then
  # JSON 转义：把反斜杠、双引号、换行处理掉
  ESC_TITLE=$(printf '%s' "$TITLE" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
  ESC_BODY=$(printf '%s' "$BODY" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')

  PAYLOAD=$(printf '{"title":"%s","body":"%s","host":"%s","time":"%s"}' \
    "$ESC_TITLE" "$ESC_BODY" "$HOSTNAME_SHORT" "$TIMESTAMP")

  CODE=$(curl -s -o /dev/null --max-time 15 -w '%{http_code}' \
    -X POST "$WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD" 2>&1)

  if [ "$CODE" = "200" ] || [ "$CODE" = "204" ]; then
    log "✓ Webhook 推送成功（HTTP $CODE）"
    SENT=$((SENT+1))
  else
    log "✗ Webhook 推送失败（HTTP $CODE）"
    FAILED=$((FAILED+1))
  fi
fi

log "结果：成功 $SENT，失败 $FAILED"

[ "$FAILED" -gt 0 ] && exit 1
exit 0
