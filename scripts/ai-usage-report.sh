#!/bin/bash
#
# AI 用量与成本日报。
#
# 用途：回答「今天跑了多少轮采集、导入多少条、花了多少钱」。
#
# ## 数据来源的分工（重要）
#
# 三处数据各有盲区，必须交叉：
#
#   logs/news-pipeline.log  采集轮次、每轮导入/分析数、耗时
#                           → 只覆盖「由脚本触发的那些轮」
#                             手动调用 API、或日志被清理时会有遗漏
#
#   数据库                   实际入库量与完成分析量
#                           → **权威来源**，不受日志影响
#
#   logs/ai-usage.log       每次 AI 调用的 token 用量
#                           → 只从加了记录之后才有效
#
# 因此「导入/分析」以数据库为准，「轮次」与「token」用日志。
# 当分析量大于 AI 调用次数时，说明有调用没被记录 —— 报表会明确指出，
# 而不是让读者以为「30 条分析只花了 1 次调用」。
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

TARGET=""
WEEK=0

case "${1:-}" in
  --week) WEEK=1 ;;
  "") TARGET=$(date '+%Y-%m-%d') ;;
  *) TARGET="$1" ;;
esac

python3 - "$TARGET" "$WEEK" "$USAGE_LOG" "$PIPELINE_LOG" <<'PYEOF'
import sys, os, json, re, sqlite3
from datetime import datetime, timedelta

target, week_flag, usage_log, pipeline_log = sys.argv[1], sys.argv[2] == "1", sys.argv[3], sys.argv[4]

# ---------- 定价（元/百万 tokens），来源官方文档 ----------
P = {
    "hit_idle": 0.02,  "hit_peak": 0.04,
    "miss_idle": 1.0,  "miss_peak": 2.0,
    "out_idle": 4.0,   "out_peak": 8.0,
}
SYSTEM_TOK = 1021  # 系统提示词，可命中缓存

def is_peak(dt):
    """北京时间周一至周五 9-12、14-18 为高峰。"""
    if dt.weekday() >= 5:
        return False
    return (9 <= dt.hour < 12) or (14 <= dt.hour < 18)

def cost(in_tok, out_tok, peak):
    hit = min(in_tok, SYSTEM_TOK)
    miss = max(0, in_tok - SYSTEM_TOK)
    c = hit / 1e6 * (P["hit_peak"] if peak else P["hit_idle"])
    c += miss / 1e6 * (P["miss_peak"] if peak else P["miss_idle"])
    c += out_tok / 1e6 * (P["out_peak"] if peak else P["out_idle"])
    return c

# ---------- AI 用量 ----------
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

# ---------- 采集日志 ----------
def pipeline_stats(day):
    runs, imported, analyzed, durations = 0, 0, 0, []
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

# ---------- 数据库（权威来源）----------
def db_stats(day):
    """统计某天入库量与完成分析量。按本地时区当天 0 点起算。"""
    try:
        dt = datetime.strptime(day, "%Y-%m-%d")
    except Exception:
        return None, None

    start = dt.timestamp() * 1000
    end = (dt + timedelta(days=1)).timestamp() * 1000

    try:
        conn = sqlite3.connect("prisma/dev.db")
        c = conn.cursor()

        c.execute("SELECT COUNT(*) FROM News WHERE createdAt >= ? AND createdAt < ?", (start, end))
        ingested = c.fetchone()[0]

        c.execute(
            "SELECT COUNT(*) FROM News WHERE createdAt >= ? AND createdAt < ? AND analysisStatus='completed'",
            (start, end),
        )
        analyzed = c.fetchone()[0]

        conn.close()
        return ingested, analyzed
    except Exception:
        return None, None

# ---------- 日期范围 ----------
if week_flag:
    now = datetime.now()
    days = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
else:
    days = [target]

# ---------- 输出 ----------
print()
print("=" * 68)
print("  AI 用量与成本报告" + ("（最近 7 天）" if week_flag else f"：{target}"))
print("=" * 68)

G = {"runs": 0, "ingested": 0, "analyzed": 0, "calls": 0, "in": 0, "out": 0, "reason": 0, "cost": 0.0}

for day in days:
    day_recs = [r for r in records if rec_date(r) == day]
    runs, log_imported, log_analyzed, durations = pipeline_stats(day)
    db_ingested, db_analyzed = db_stats(day)

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

    # 入库/分析以数据库为准，缺失时退回日志
    ingested = db_ingested if db_ingested is not None else log_imported
    analyzed = db_analyzed if db_analyzed is not None else log_analyzed

    G["runs"] += runs
    G["ingested"] += ingested or 0
    G["analyzed"] += analyzed or 0
    G["calls"] += len(day_recs)
    G["in"] += in_tok
    G["out"] += out_tok
    G["reason"] += reason
    G["cost"] += c

    print()
    print(f"  {day}")
    print(f"    采集轮次      {runs} 轮" + (f"（平均耗时 {sum(durations)//len(durations)} 秒）" if durations else ""))
    print(f"    入库新闻      {ingested} 条  ← 数据库")
    print(f"    完成分析      {analyzed} 条  ← 数据库")
    print(f"    AI 调用       {len(day_recs)} 次  ← 用量日志")

    if day_recs:
        print(f"    输入 token    {in_tok:,}")
        print(f"    输出 token    {out_tok:,}" + (f"（其中推理 {reason:,}）" if reason else ""))
        print(f"    估算成本      ¥{c:.3f}")
    else:
        print(f"    估算成本      —（无用量记录）")

    # 不一致时明确提示，避免读者误以为「30 条分析只花了 1 次调用」
    if analyzed and len(day_recs) and analyzed > len(day_recs) * 1.2:
        print()
        print(f"    ⚠ 分析 {analyzed} 条但只记录到 {len(day_recs)} 次调用：")
        print(f"      差额来自用量日志启用之前、或日志被清理时发生的调用。")
        print(f"      真实成本会高于上面数字，可按 {analyzed} 次 × 单条均价估算。")

if week_flag:
    print()
    print("-" * 68)
    print("  合计")
    print(f"    采集轮次      {G['runs']} 轮")
    print(f"    入库新闻      {G['ingested']} 条")
    print(f"    完成分析      {G['analyzed']} 条")
    print(f"    AI 调用       {G['calls']} 次")
    print(f"    输入 token    {G['in']:,}")
    print(f"    输出 token    {G['out']:,}")
    print(f"    估算成本      ¥{G['cost']:.2f}")
    if G["calls"]:
        print(f"    单次均摊      ¥{G['cost']/G['calls']:.4f}")

print()
print("=" * 68)
print("  说明")
print("  · 入库/分析量取自数据库，不受日志缺失影响")
print("  · 采集轮次与 token 取自日志；日志启用前的调用无法统计")
print("  · 成本按官方定价逐条计算，区分高峰（工作日 9-12、14-18）与空闲时段")
print("  · 系统提示词 1021 tokens 按缓存命中计价，其余按未命中")
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
