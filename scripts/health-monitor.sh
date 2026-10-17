#!/bin/bash
#
# 站点健康监控 + 告警。
#
# 检查四项：
#   1. 应用本地可达（127.0.0.1:3000）
#   2. 域名可达（https://aibiliai.com，强制 IPv4）
#   3. 隧道服务在运行
#   4. 磁盘与内存余量
#
# 关键设计：**只在状态变化时告警**。
#
#   若每次检查都推送，机器故障期间会每小时发一条，很快被无视 ——
#   告警的价值在于「变化」，不是「持续」。
#   因此用状态文件记录上一轮结果：
#     · 正常 → 故障  ：立即告警（出事了）
#     · 故障 → 正常  ：发恢复通知（知道好了）
#     · 故障 → 故障  ：不重复发，只记日志
#     · 正常 → 正常  ：不发送
#
# 为什么域名检查用 -4：
#   Cloudflare 的 AAAA 记录在当前网络下不可达（已确认无解），
#   不加 -4 会因 IPv6 超时而误判站点故障。

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
LOG="$PROJECT_DIR/logs/health-monitor.log"
ALERT="$PROJECT_DIR/scripts/alert.sh"
STATE_FILE="$HOME/.health-state"

LOCAL_URL="http://127.0.0.1:3000/"
DOMAIN_URL="https://aibiliai.com/"

DISK_MIN_PERCENT=15     # 可用空间低于这个百分比就告警
MEM_MIN_MB=300          # 可用内存低于这个值就告警

mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# ---------- 上一次的状态 ----------
PREV="ok"
if [ -f "$STATE_FILE" ]; then
  PREV=$(tr -d '[:space:]' < "$STATE_FILE" 2>/dev/null)
  [ -z "$PREV" ] && PREV="ok"
fi

# ---------- 逐项检查 ----------
PROBLEMS=""

# 1. 本地应用
LOCAL_CODE=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$LOCAL_URL" 2>/dev/null)
if [ "$LOCAL_CODE" != "200" ]; then
  PROBLEMS="${PROBLEMS}· 本地应用不可达（HTTP $LOCAL_CODE）
"
fi

# 2. 域名（强制 IPv4）
DOMAIN_CODE=$(curl -4 -s -o /dev/null -m 25 -w '%{http_code}' "$DOMAIN_URL" 2>/dev/null)
if [ "$DOMAIN_CODE" != "200" ]; then
  # 失败一次不算，重试两次再下结论（避免瞬时抖动误报）
  sleep 5
  DOMAIN_CODE=$(curl -4 -s -o /dev/null -m 25 -w '%{http_code}' "$DOMAIN_URL" 2>/dev/null)
  sleep 5
  DOMAIN_CODE=$(curl -4 -s -o /dev/null -m 25 -w '%{http_code}' "$DOMAIN_URL" 2>/dev/null)

  if [ "$DOMAIN_CODE" != "200" ]; then
    PROBLEMS="${PROBLEMS}· 域名访问失败（连续 3 次，最后一次 HTTP $DOMAIN_CODE）
"
  fi
fi

# 3. 隧道
TUNNEL=$(systemctl is-active cloudflared-ipv4 2>/dev/null || echo "unknown")
if [ "$TUNNEL" != "active" ]; then
  PROBLEMS="${PROBLEMS}· 隧道服务异常（$TUNNEL）
"
fi

# 4. 磁盘
DISK_FREE=$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9')
if [ -n "$DISK_FREE" ]; then
  DISK_AVAIL=$(( 100 - DISK_FREE ))
  if [ "$DISK_AVAIL" -lt "$DISK_MIN_PERCENT" ]; then
    PROBLEMS="${PROBLEMS}· 磁盘可用仅 ${DISK_AVAIL}%（阈值 ${DISK_MIN_PERCENT}%）
"
  fi
fi

# 5. 内存
MEM_AVAIL_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}')
if [ -n "$MEM_AVAIL_MB" ] && [ "$MEM_AVAIL_MB" -lt "$MEM_MIN_MB" ] 2>/dev/null; then
  PROBLEMS="${PROBLEMS}· 可用内存仅 ${MEM_AVAIL_MB}MB（阈值 ${MEM_MIN_MB}MB）
"
fi

# ---------- 判定与告警 ----------
if [ -n "$PROBLEMS" ]; then
  NOW_STATE="fail"
  log "✗ 异常：$(printf '%s' "$PROBLEMS" | tr '\n' ' ')"

  if [ "$PREV" = "ok" ]; then
    # 正常 → 故障：立即告警
    log "状态变化 ok → fail，发送告警"
    bash "$ALERT" "站点异常" "$PROBLEMS" 2>/dev/null
  else
    log "状态持续异常，不重复告警"
  fi
else
  NOW_STATE="ok"
  log "✓ 全部正常（本地 $LOCAL_CODE / 域名 $DOMAIN_CODE / 隧道 $TUNNEL / 磁盘可用 ${DISK_AVAIL:-?}% / 内存 ${MEM_AVAIL_MB:-?}MB）"

  if [ "$PREV" = "fail" ]; then
    # 故障 → 正常：发恢复通知
    log "状态变化 fail → ok，发送恢复通知"
    bash "$ALERT" "站点已恢复" "本地与域名访问均正常，隧道 active。" 2>/dev/null
  fi
fi

echo "$NOW_STATE" > "$STATE_FILE"

if [ "$NOW_STATE" = "ok" ]; then
  exit 0
fi

exit 1
