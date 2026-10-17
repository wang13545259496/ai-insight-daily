#!/bin/bash
#
# AI 用量与成本日报。
#
# 用途：回答「今天跑了多少轮采集、导入多少条、花了多少钱」。
#
# 数据来源：
#   logs/news-pipeline.log   每轮采集的时间、导入数、耗时
#   logs/ai-usage.log        每次 AI 调用的 token 用量（JSONL）
#   数据库                    实际入库量与分析量
#   DeepSeek 余额接口         当前余额
#
# 用法：
#   bash scripts/ai-usage-report.sh            # 今天
#   bash scripts/ai-usage-report.sh 2026-10-17 # 指定日期
#   bash scripts/ai-usage-report.sh --week     # 最近 7 天汇总

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
cd "$PROJECT_DIR" || exit 1

USAGE_LOG="logs/ai-usage.log"
PIPELINE_LOG="logs/news-pipeline.log"

# ---------- 参数 ----------
TARGET=""
WEEK=0

case "${1:-}" in
  --week) WEEK=1 ;;
  "") TARGET=$(date '+%Y-%m-%d') ;;
  *) TARGET="$1" ;;
esac

# ---------- 定价（元/百万 tokens）----------
# 来源 https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
# deepseek-flash：空闲时段为高峰时段一半
# 高峰：周一至周五 9:00-12:00、14:00-18:00（北京时间）
PRICE_HIT_IDLE=0.02
PRICE_HIT_PEAK=0.04
PRICE_MISS_IDLE=1.0
PRICE_MISS_PEAK=2.0
PRICE_OUT_IDLE=4.0
PRICE_OUT_PEAK=8.0

python3 - "$TARGET" "$WEEK" "$USAGE_LOG" "$PIPELINE_LOG" <<'PYEOF'
import sys, os, json, subprocess, re
from datetime import datetime, timedelta, timezone

target, week_flag, usage_log, pipeline_log = sys.argv[1], sys.argv[2] == "1", sys.argv[3], sys.argv[4]

# ---------- 定价 ----------
P = {
    "hit_idle": 0.02, "hit_peak": 0.04,
    "miss_idle": 1.0, "miss_peak": 2.0,
    "out_idle": 4.0, "out_peak": 8.0,
}
SYSTEM_TOK = 1021   # 系统提示词，可命中缓存

def is_peak(dt):
    """北京时间周一至周五 9-12、14-18 为高峰。"""
    if dt.weekday() >= 5:
        return False
    h = dt.hour
    return (9 <= h < 12) or (14 <= h < 18)

def cost(in_tok, out_tok, peak):
    """按缓存命中估算：系统提示词部分命中缓存，其余算未命中。"""
    hit = min(in_tok, SYSTEM_TOK)
    miss = max(0, in_tok - SYSTEM_TOK)

    c = 0.0
    c += hit / 1e6 * (P["hit_peak"] if peak else P["hit_idle"])
    c += miss / 1e6 * (P["miss_peak"] if peak else P["miss_idle"])
    c += out_tok / 1e6 * (P["out_peak"] if peak else P["out_idle"])
    return c

# ---------- 读取 AI 用量 ----------
records = []
if os.path.exists(usage_log):
    with open(usage_log, encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except Exception:
                pass

def rec_date(r):
    try:
        return datetime.fromisoformat(r["t"].replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d")
    except Exception:
        return None

# ---------- 确定日期范围 ----------
if week_flag:
    end = datetime.now()
    days = [(end - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
else:
    days = [target]

# ---------- 读取采集日志 ----------
def pipeline_stats(day):
    runs = 0
    imported = 0
    analyzed = 0
    durations = []

    if not os.path.exists(pipeline_log):
        return runs, imported, analyzed, durations

    with open(pipeline_log, encoding="utf-8", errors="ignore") as f:
        for line in f:
            if day not in line:
                continue
            if "调用 /api/cron/daily" in line:
                runs += 1
            m = re.search(r"导入 (\d+) 条，分析 (\d+) 条.*耗时 (\d+) 秒", line)
            if m:
                imported += int(m.group(1))
                analyzed += int(m.group(2))
                durations.append(int(m.group(3)))
    return runs, imported, analyzed, durations

# ---------- 输出 ----------
print()
print("=" * 66)
print("  AI 用量与成本报告" + ("（最近 7 天）" if week_flag else f"：{target}"))
print("=" * 66)

grand = {"runs": 0, "imported": 0, "analyzed": 0, "in": 0, "out": 0, "reason": 0, "cost": 0.0, "calls": 0}

for day in days:
    day_recs = [r for r in records if rec_date(r) == day]
    runs, imported, analyzed, durations = pipeline_stats(day)

    in_tok = sum(r.get("in", 0) for r in day_recs)
    out_tok = sum(r.get("out", 0) for r in day_recs)
    reason = sum(r.get("reason", 0) for r in day_recs)

    c = 0.0
    for r in day_recs:
        try:
            dt = datetime.fromisoformat(r["t"].replace("Z", "+00:00")).astimezone()
        except Exception:
            dt = datetime.now()
        c += cost(r.get("in", 0), r.get("out", 0), is_peak(dt))

    grand["runs"] += runs
    grand["imported"] += imported
    grand["analyzed"] += analyzed
    grand["in"] += in_tok
    grand["out"] += out_tok
    grand["reason"] += reason
    grand["cost"] += c
    grand["calls"] += len(day_recs)

    print()
    print(f"  {day}")
    print(f"    采集轮次      {runs} 轮" + (f"（平均耗时 {sum(durations)//len(durations)} 秒）" if durations else ""))
    print(f"    导入新闻      {imported} 条")
    print(f"    完成分析      {analyzed} 条")
    print(f"    AI 调用       {len(day_recs)} 次")
    if day_recs:
        print(f"    输入 token    {in_tok:,}")
        print(f"    输出 token    {out_tok:,}" + (f"（其中推理 {reason:,}）" if reason else ""))
        print(f"    估算成本      ¥{c:.3f}")
    else:
        print(f"    （无 AI 调用记录）")

if week_flag:
    print()
    print("-" * 66)
    print(f"  合计")
    print(f"    采集轮次      {grand['runs']} 轮")
    print(f"    导入新闻      {grand['imported']} 条")
    print(f"    完成分析      {grand['analyzed']} 条")
    print(f"    AI 调用       {grand['calls']} 次")
    print(f"    输入 token    {grand['in']:,}")
    print(f"    输出 token    {grand['out']:,}")
    print(f"    估算成本      ¥{grand['cost']:.2f}")
    if grand["calls"]:
        print(f"    单条均摊      ¥{grand['cost']/max(grand['analyzed'],1):.4f}")

print()
print("=" * 66)
print("  说明")
print("  · 成本按官方定价与调用时刻所处时段（高峰/空闲）逐条计算")
print("  · 系统提示词 1021 tokens 按缓存命中计价，其余按未命中")
print("  · 数据来源：logs/ai-usage.log 与 logs/news-pipeline.log")
PYEOF

# ---------- 余额 ----------
echo ""
KEY=$(grep '^DEEPSEEK_API_KEY=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '\r' | tr -d '"')

if [ -n "$KEY" ]; then
  BAL=$(curl -s --max-time 15 https://api.deepseek.com/user/balance \
    -H "Authorization: Bearer $KEY" 2>/dev/null \
    | grep -oE '"total_balance":"[0-9.]+"' | head -1 | grep -oE '[0-9.]+')

  if [ -n "$BAL" ]; then
    echo "  当前余额：¥$BAL"
    echo ""
  fi
fi
