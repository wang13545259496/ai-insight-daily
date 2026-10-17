#!/bin/bash
#
# 配置告警渠道。
#
# 为什么做成脚本而不是让用户编辑 .env.local：
#   · 手工编辑容易把密钥写进注释行、或重复追加多条
#   · 换渠道时还要记得删旧的，否则两个渠道同时推送
#   · 配完需要一个可验证的方式确认真的能收到
#
# 幂等：同一渠道重复设置会覆盖，不会产生多行。
#
# 用法：
#   bash scripts/set-alert-channel.sh serverchan SCTxxxxx
#   bash scripts/set-alert-channel.sh telegram 123:ABC 你的chatid
#   bash scripts/set-alert-channel.sh webhook https://example.com/hook
#   bash scripts/set-alert-channel.sh status
#   bash scripts/set-alert-channel.sh test
#   bash scripts/set-alert-channel.sh clear

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
ENV_FILE="$PROJECT_DIR/.env.local"

ACTION="${1:-status}"

# ---------- 工具函数 ----------

# 删除某个键的所有行（无论是否被注释）
remove_key() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0

  # 用临时文件，避免 sed -i 在不同平台行为差异
  grep -v -E "^[[:space:]]*#?[[:space:]]*${key}=" "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

# 追加一个键值（先删后加，保证唯一）
set_key() {
  local key="$1"
  local val="$2"

  touch "$ENV_FILE"
  remove_key "$key"
  printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
}

# 读取当前配置（只看未注释的）
read_key() {
  local key="$1"
  [ -f "$ENV_FILE" ] || { echo ""; return; }
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r'
}

mask() {
  local v="$1"
  local n=${#v}
  if [ "$n" -le 8 ]; then
    echo "***"
  else
    echo "${v:0:4}***${v: -4}（共 $n 字符）"
  fi
}

show_status() {
  echo "=== 当前告警配置 ==="
  echo ""

  local sc tg tk ch wh
  sc=$(read_key SERVERCHAN_KEY)
  tg=$(read_key TELEGRAM_BOT_TOKEN)
  ch=$(read_key TELEGRAM_CHAT_ID)
  wh=$(read_key ALERT_WEBHOOK_URL)

  if [ -n "$sc" ]; then
    echo "  Server 酱:  已配置  $(mask "$sc")"
  else
    echo "  Server 酱:  未配置"
  fi

  if [ -n "$tg" ] && [ -n "$ch" ]; then
    echo "  Telegram:   已配置  token $(mask "$tg")  chat $ch"
  elif [ -n "$tg" ]; then
    echo "  Telegram:   不完整（有 token 缺 chat_id）"
  else
    echo "  Telegram:   未配置"
  fi

  if [ -n "$wh" ]; then
    echo "  Webhook:    已配置  $(mask "$wh")"
  else
    echo "  Webhook:    未配置"
  fi

  echo ""

  if [ -z "$sc" ] && [ -z "$tg" ] && [ -z "$wh" ]; then
    echo "  ⚠ 没有任何渠道 —— 告警只会写进 logs/alert.log"
    echo ""
    echo "  配置方法："
    echo "    bash scripts/set-alert-channel.sh serverchan SCT你的密钥"
    echo "    bash scripts/set-alert-channel.sh telegram 123:ABC 你的chatid"
    echo "    bash scripts/set-alert-channel.sh webhook https://你的地址"
  else
    echo "  ✓ 至少一个渠道可用"
  fi
}

# ---------- 主逻辑 ----------

case "$ACTION" in
  serverchan)
    KEY="${2:-}"
    if [ -z "$KEY" ]; then
      echo "✗ 缺少 SendKey"
      echo "  用法：bash scripts/set-alert-channel.sh serverchan SCTxxxxx"
      exit 1
    fi
    if ! echo "$KEY" | grep -qE '^SCT[A-Za-z0-9]+$'; then
      echo "⚠ SendKey 通常以 SCT 开头，你给的是：$(mask "$KEY")"
      echo "  仍继续设置。若推送失败请核对 https://sct.ftqq.com 上的 SendKey。"
    fi
    set_key SERVERCHAN_KEY "$KEY"
    echo "✓ Server 酱已配置：$(mask "$KEY")"
    echo ""
    echo "  下一步验证：bash scripts/set-alert-channel.sh test"
    ;;

  telegram)
    TOKEN="${2:-}"
    CHAT="${3:-}"
    if [ -z "$TOKEN" ] || [ -z "$CHAT" ]; then
      echo "✗ 缺少参数"
      echo "  用法：bash scripts/set-alert-channel.sh telegram 123456:ABC-DEF 你的chat_id"
      echo ""
      echo "  获取方式："
      echo "   1. 在 Telegram 找 @BotFather → /newbot → 拿到 token"
      echo "   2. 给你的机器人发一条消息"
      echo "   3. 访问 https://api.telegram.org/bot<token>/getUpdates 找 chat.id"
      exit 1
    fi
    set_key TELEGRAM_BOT_TOKEN "$TOKEN"
    set_key TELEGRAM_CHAT_ID "$CHAT"
    echo "✓ Telegram 已配置"
    echo "  token: $(mask "$TOKEN")"
    echo "  chat:  $CHAT"
    echo ""
    echo "  下一步验证：bash scripts/set-alert-channel.sh test"
    ;;

  webhook)
    URL="${2:-}"
    if [ -z "$URL" ]; then
      echo "✗ 缺少地址"
      echo "  用法：bash scripts/set-alert-channel.sh webhook https://example.com/hook"
      exit 1
    fi
    if ! echo "$URL" | grep -qE '^https?://'; then
      echo "✗ 地址必须以 http:// 或 https:// 开头"
      exit 1
    fi
    set_key ALERT_WEBHOOK_URL "$URL"
    echo "✓ Webhook 已配置：$(mask "$URL")"
    echo ""
    echo "  会向该地址 POST："
    echo '    {"title":"...","body":"...","host":"...","time":"..."}'
    echo ""
    echo "  下一步验证：bash scripts/set-alert-channel.sh test"
    ;;

  test)
    echo "=== 发送测试告警 ==="
    echo ""
    bash "$PROJECT_DIR/scripts/alert.sh" "测试告警" "如果你收到这条消息，说明告警渠道配置成功。"
    CODE=$?
    echo ""
    echo "  退出码: $CODE"
    echo ""
    echo "  logs/alert.log 最后 6 行:"
    tail -6 "$PROJECT_DIR/logs/alert.log" 2>/dev/null | sed 's/^/    /'
    echo ""
    if [ "$CODE" = "0" ]; then
      echo "  ✓ 无推送错误。若配置了渠道，请检查手机/客户端是否收到。"
      echo "    没收到的话常见原因：SendKey 错误、机器人未开始对话、webhook 需要特定格式"
    else
      echo "  ✗ 推送失败，看上面日志里的错误信息"
    fi
    ;;

  clear)
    remove_key SERVERCHAN_KEY
    remove_key TELEGRAM_BOT_TOKEN
    remove_key TELEGRAM_CHAT_ID
    remove_key ALERT_WEBHOOK_URL
    echo "✓ 已清除全部告警渠道配置"
    echo "  告警将只写入 logs/alert.log"
    ;;

  status|*)
    show_status
    ;;
esac
