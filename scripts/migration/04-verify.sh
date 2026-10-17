#!/bin/bash
# ============================================================
#  迁移后全链路验证
#
#  在【本地 WSL】执行。
#
#  检查 9 项：
#      1. 服务状态（PM2）
#      2. 页面可达
#      3. 数据库记录数一致
#      4. AI 分析状态
#      5. 配置变量齐全
#      6. 定时任务
#      7. 采集能否真的抓（最关键）
#      8. 告警通道
#      9. 之前的 bug 是否跟着过去（AI 标识、移动端导航）
# ============================================================

set -uo pipefail

SERVER="${DEPLOY_SERVER:-root@CHANGE_ME}"
APP_DIR="${DEPLOY_APP_DIR:-/root/ai-insight-daily}"
PM2_NAME="${DEPLOY_PM2_NAME:-ai-insight-daily}"

PASS=0
FAIL=0
WARN=0

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
pass() { printf '  \033[32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; WARN=$((WARN+1)); }

[ "$SERVER" = "root@CHANGE_ME" ] && { echo "未配置 DEPLOY_SERVER"; exit 1; }

REMOTE() { ssh "$SERVER" "$@" 2>/dev/null; }

log "1. 服务状态"
STATUS=$(REMOTE "pm2 jlist" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try{const a=JSON.parse(s).find(x=>x.name==='$PM2_NAME');
    console.log(a?a.pm2_env.status:'missing');}catch(e){console.log('parse-error')}
});" 2>/dev/null)
[ "$STATUS" = "online" ] && pass "PM2: online" || fail "PM2 状态: $STATUS"

UPTIME=$(REMOTE "pm2 jlist" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try{const a=JSON.parse(s).find(x=>x.name==='$PM2_NAME');
    console.log(a?Math.round((Date.now()-a.pm2_env.pm_uptime)/1000):0);}catch(e){console.log(0)}
});" 2>/dev/null)
[ "${UPTIME:-0}" -gt 5 ] && pass "运行 ${UPTIME}s" || warn "刚启动（${UPTIME}s）"

log "2. 页面可达"
for P in "/" "/news" "/events" "/entities" "/investment" "/about" "/privacy" "/robots.txt"; do
    CODE=$(REMOTE "curl -s -o /dev/null -m 25 -w '%{http_code}' http://127.0.0.1:3000$P")
    if [ "$CODE" = "200" ]; then pass "$P → 200"; else fail "$P → $CODE"; fi
done

log "3. 数据库"
LOCAL_NEWS=$(cd "$(git rev-parse --show-toplevel)" && sqlite3 prisma/dev.db "SELECT COUNT(*) FROM News;" 2>/dev/null || echo "?")
REMOTE_NEWS=$(REMOTE "sqlite3 $APP_DIR/prisma/dev.db 'SELECT COUNT(*) FROM News;'")
[ "$LOCAL_NEWS" = "$REMOTE_NEWS" ] && pass "News $REMOTE_NEWS 条（与本地一致）" || fail "News 本地 $LOCAL_NEWS / 远端 $REMOTE_NEWS"

PENDING=$(REMOTE "sqlite3 $APP_DIR/prisma/dev.db \"SELECT COUNT(*) FROM News WHERE analysisStatus='pending' AND dataStatus='active';\"")
[ "${PENDING:-0}" -lt 50 ] && pass "待分析 $PENDING 条" || warn "待分析 ${PENDING} 条（偏多）"

log "4. AI 分析"
ANALYZED=$(REMOTE "sqlite3 $APP_DIR/prisma/dev.db \"SELECT COUNT(*) FROM News WHERE analysisStatus='completed';\"")
[ "${ANALYZED:-0}" -gt 100 ] && pass "已分析 $ANALYZED 条" || fail "已分析仅 ${ANALYZED} 条"

log "5. 配置"
for K in DEEPSEEK_API_KEY CRON_SECRET SERVERCHAN_KEY; do
    HAS=$(REMOTE "grep -c '^$K=' $APP_DIR/.env.local 2>/dev/null || echo 0")
    [ "${HAS:-0}" -ge 1 ] && pass "$K 已配置" || fail "$K 缺失"
done
PERM=$(REMOTE "stat -c '%a' $APP_DIR/.env.local 2>/dev/null")
[ "$PERM" = "600" ] && pass ".env.local 权限 600" || warn ".env.local 权限 $PERM（建议 600）"

log "6. 定时任务"
CRON_N=$(REMOTE "crontab -l 2>/dev/null | grep -vcE '^#|^$'")
[ "${CRON_N:-0}" -ge 8 ] && pass "$CRON_N 条任务" || fail "只有 ${CRON_N} 条（应为 8）"

log "7. 采集（最关键）"
echo "  触发一次采集，观察能否抓到境外源..."
COLLECT=$(REMOTE "cd $APP_DIR && timeout 300 npm run pipeline:news 2>&1 | tail -20")
if echo "$COLLECT" | grep -qiE '抓取完成|fetched|imported'; then
    pass "采集流程跑通"
    echo "$COLLECT" | grep -iE '抓取完成|失败' | head -3 | sed 's/^/      /'
    if echo "$COLLECT" | grep -qiE '失败'; then
        warn "有源失败（看上面的列表，可能正常）"
    fi
else
    fail "采集未跑通"
    echo "$COLLECT" | tail -5 | sed 's/^/      /'
fi

log "8. 告警通道"
ALERT=$(REMOTE "cd $APP_DIR && bash scripts/alert.sh test 2>&1 | tail -3")
if echo "$ALERT" | grep -qiE '成功|已发送|sent|ok'; then
    pass "告警通道可用（应已收到微信）"
else
    warn "告警结果: $(echo "$ALERT" | tail -1)"
fi

log "9. 功能回归"
HOME_HTML=$(REMOTE "curl -s -m 25 http://127.0.0.1:3000/")
echo "$HOME_HTML" | grep -q 'AI 生成' && pass "AI 标识存在" || fail "AI 标识丢失"
echo "$HOME_HTML" | grep -q '最新产业情报' && pass "首页新闻流在前" || fail "首页结构异常"

ROBOTS=$(REMOTE "curl -s -m 15 http://127.0.0.1:3000/robots.txt")
echo "$ROBOTS" | grep -q 'Disallow: /' && pass "robots 仍禁止收录" || fail "robots 状态错误"

META=$(REMOTE "curl -s -m 25 http://127.0.0.1:3000/" | grep -c 'ai-content')
[ "${META:-0}" -ge 1 ] && pass "AI 隐式标识 meta 存在" || fail "meta 标识丢失"

# ---------- 汇总 ----------
echo ""
printf '=%.0s' {1..60}; echo ""
printf '  通过 \033[32m%d\033[0m   失败 \033[31m%d\033[0m   警告 \033[33m%d\033[0m\n' "$PASS" "$FAIL" "$WARN"
printf '=%.0s' {1..60}; echo ""

if [ "$FAIL" -eq 0 ]; then
    echo ""
    echo "  ✓ 全部通过，可以执行 05-decommission-local.sh 停掉本地服务"
    exit 0
else
    echo ""
    echo "  ✗ 有 $FAIL 项失败，先修好再停本地服务"
    echo "  看日志: ssh $SERVER \"pm2 logs $PM2_NAME --lines 100 --nostream\""
    exit 1
fi
