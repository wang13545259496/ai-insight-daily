#!/bin/bash
#
# 安装全部定时任务（真正幂等）。
#
# 上一版的缺陷：过滤旧条目时只删「含项目路径的行」，
# 注释行没有路径，于是每次运行都累积一份注释块。
# 功能上无害（cron 条目始终是 6 条且不重复），但文件越来越乱。
#
# 本版改用**受管区块标记**：
#   写入时用 BEGIN/END 包起来，重装时先删掉标记之间的全部内容，
#   再整块写入。区块之外的内容（用户自建任务）原样保留。
#
# 为什么需要这个脚本：
#   RECOVERY.md 原来直接贴 crontab 命令，新机器上手工粘贴容易出错。
#   而那些任务的设计意图（为什么不用固定时间点）也需要一并固化。
#
# 用法：
#   bash scripts/install-cron.sh

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
OLD_CRON="$HOME/.crontab.before-install"

BEGIN_MARK="# >>> AI Insight Daily managed block >>>"
END_MARK="# <<< AI Insight Daily managed block <<<"

echo "=== 1. 备份现有 crontab ==="
crontab -l > "$OLD_CRON" 2>/dev/null || true
TOTAL=$(grep -v '^#' "$OLD_CRON" 2>/dev/null | grep -vc '^$' || echo 0)
echo "  已备份到 $OLD_CRON（$TOTAL 条有效行）"

echo ""
echo "=== 2. 移除旧的受管区块 ==="

# awk 状态机：跳过 BEGIN 与 END 之间的所有行（含标记本身）
KEEP=$(crontab -l 2>/dev/null | awk -v B="$BEGIN_MARK" -v E="$END_MARK" '
  $0 == B { inblock = 1; next }
  $0 == E { inblock = 0; next }
  !inblock { print }
')

# 顺带清理更早版本留下的孤儿注释（它们没有标记包裹）
KEEP=$(printf '%s\n' "$KEEP" | grep -v '由 scripts/install-cron.sh 写入' \
  | grep -v '由 scripts/install-p0-cron.sh' \
  | grep -v 'AI Insight Daily 定时任务 =====' \
  | grep -v '这台机器不 24 小时开机，而 cron' \
  | grep -v '这台机器不 24 小时开机，cron' \
  | grep -v '因此所有任务都用' \
  | grep -v '因此所有任务都采用' \
  | grep -v '不依赖某个固定时间点' \
  | grep -v '而不是指望某个固定时间点' \
  | grep -v '教训：' \
  | grep -v '原 0 3 \* \* \* 备份' \
  | grep -v '原 0 2 \* \* \* 采集' \
  | grep -v '新闻采集：每小时检查陈旧度' \
  | grep -v '健康监控：每小时一次' \
  | grep -v '健康监控：每小时 + 开机' \
  | grep -v '数据库备份：陈旧' \
  | grep -v '数据库备份（每 20 小时' \
  | grep -v '以下为保留的原有条目' \
  | cat -s)

# 关键：区块外的旧条目若含本项目路径，说明是更早版本装的（没有标记包裹），
# 必须一并删掉 —— 否则会在区块外再保留一份，条目翻倍。
KEEP=$(printf '%s\n' "$KEEP" | grep -v -F "$PROJECT_DIR" || true)

# 清理更早版本留下的分节标题
KEEP=$(printf '%s\n' "$KEEP" | grep -v '以下为区块外的其它任务' \
  | grep -v '以下为保留的原有条目' || true)

# 去掉纯空行结尾
KEEP=$(printf '%s\n' "$KEEP" | sed -e :a -e '/^$/{$d;N;ba' -e '}' || true)

echo "  保留区块外条目: $(printf '%s\n' "$KEEP" | grep -v '^#' | grep -vc '^$' || echo 0) 条"

echo ""
echo "=== 3. 写入新 crontab ==="

{
  printf '%s\n' "$BEGIN_MARK"
  cat <<EOF
# 由 scripts/install-cron.sh 生成，请勿手工编辑本区块
#
# 设计原则：这台机器不 24 小时开机，而 cron 不补跑错过的任务。
# 因此所有任务都用「定时触发 + 陈旧度判断 + @reboot 补跑」，
# 不依赖某个固定时间点机器一定开着。
#
# 教训：
#   · 原 0 3 * * * 备份 → 10 天里只成功 1 次
#   · 原 0 2 * * * 采集 → logs/daily-cron.log 从未生成

# 新闻采集：每小时检查陈旧度（>6 小时才真跑）
0 * * * * $PROJECT_DIR/scripts/news-pipeline-scheduler.sh
@reboot sleep 180 && $PROJECT_DIR/scripts/news-pipeline-scheduler.sh

# 健康监控：每小时一次，仅在状态变化时告警
15 * * * * $PROJECT_DIR/scripts/health-monitor.sh
@reboot sleep 240 && $PROJECT_DIR/scripts/health-monitor.sh

# 数据库备份：陈旧 >20 小时才真跑
0 23 * * * $PROJECT_DIR/scripts/db-backup-scheduler.sh
@reboot sleep 120 && $PROJECT_DIR/scripts/db-backup-scheduler.sh
EOF
  printf '%s\n' "$END_MARK"

  # 只有真的存在「非注释、非空」的区块外任务时才输出分节。
  # 否则清理干净后仍会留下一个空标题与若干空白行。
  KEEP_REAL=$(printf '%s\n' "$KEEP" | grep -v '^#' | grep -v '^[[:space:]]*$' || true)

  if [ -n "$KEEP_REAL" ]; then
    echo ""
    echo "# ===== 以下为区块外的其它任务（原样保留）====="
    printf '%s\n' "$KEEP_REAL"
  fi
} > /tmp/dsh-crontab.new

crontab /tmp/dsh-crontab.new
CODE=$?
rm -f /tmp/dsh-crontab.new

if [ "$CODE" = "0" ]; then
  echo "  ✓ 已安装"
else
  echo "  ✗ 失败，回滚：crontab $OLD_CRON"
  exit 1
fi

echo ""
echo "=== 4. 验证 ==="
printf '  %-22s %s\n' "新闻采集" "$(crontab -l 2>/dev/null | grep -c 'news-pipeline-scheduler')（应 2）"
printf '  %-22s %s\n' "健康监控" "$(crontab -l 2>/dev/null | grep -c 'health-monitor')（应 2）"
printf '  %-22s %s\n' "数据库备份" "$(crontab -l 2>/dev/null | grep -c 'db-backup-scheduler')（应 2）"
printf '  %-22s %s\n' "旧直调 API" "$(crontab -l 2>/dev/null | grep -c '/api/cron/daily')（应 0）"
printf '  %-22s %s\n' "有效条目总数" "$(crontab -l 2>/dev/null | grep -v '^#' | grep -vc '^$')"
printf '  %-22s %s\n' "受管区块标记" "$(crontab -l 2>/dev/null | grep -c 'AI Insight Daily managed block')（应 2）"

echo ""
echo "  cron 服务: $(systemctl is-active cron 2>/dev/null)"
echo ""
echo "  回滚：crontab $OLD_CRON"
