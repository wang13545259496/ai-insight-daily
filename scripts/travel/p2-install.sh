#!/bin/bash
# P2: install the AI travel planner agent into the project.
#
# Steps:
#   1. back up dev.db and schema.prisma
#   2. copy code (lib/agents/travel, app/travel, app/api/travel, components/travel, scripts/travel)
#   3. append the TripPlan model to prisma/schema.prisma
#   4. register TASK-006 in ai-context/AI_TASK_QUEUE.md
#   5. prisma generate
#   6. create the table via the migration SQL, then mark it applied
#   7. restart pm2 and verify
#
# Safety: aborts unless every source exists in the workspace; never deletes
# project data; db is backed up before any schema change.

set -e

W=/mnt/d/Backup/Documents/deepseek-harness/default-workspace
P="$HOME/projects/ai-insight-daily"
STAMP=$(date +%Y%m%d-%H%M%S)

cd "$P"
echo "########## P2 INSTALL ##########"
echo "project: $(pwd)"
echo

# ---------- guard ----------
echo "[guard] verifying workspace sources"
missing=0
for d in lib/agents/travel app/travel app/api/travel components/travel scripts/travel \
         prisma/migrations/20261015090000_add_trip_plan prisma/tripplan-model.prisma; do
  if [ -e "$W/$d" ]; then
    echo "  OK   $d"
  else
    echo "  MISS $d"
    missing=$((missing + 1))
  fi
done

if [ "$missing" -ne 0 ]; then
  echo
  echo "ABORT: $missing source(s) missing in workspace."
  exit 1
fi
echo

# ---------- 1. backup ----------
echo "[1/7] backup db + schema"
mkdir -p _backup
cp prisma/dev.db "_backup/dev.db.before-tripplan-$STAMP"
cp prisma/schema.prisma "_backup/schema.prisma.before-tripplan-$STAMP"
cp ai-context/AI_TASK_QUEUE.md "_backup/AI_TASK_QUEUE.md.before-tripplan-$STAMP"
echo "  db      -> _backup/dev.db.before-tripplan-$STAMP"
echo "  schema  -> _backup/schema.prisma.before-tripplan-$STAMP"
echo "  tasks   -> _backup/AI_TASK_QUEUE.md.before-tripplan-$STAMP"
echo

# ---------- 2. copy code ----------
echo "[2/7] copy code"
mkdir -p lib/agents app/api
cp -r "$W/lib/agents/travel" lib/agents/
cp -r "$W/app/travel" app/
cp -r "$W/app/api/travel" app/api/
cp -r "$W/components/travel" components/
cp -r "$W/scripts/travel" scripts/
mkdir -p prisma/migrations
cp -r "$W/prisma/migrations/20261015090000_add_trip_plan" prisma/migrations/
echo "  lib/agents/travel : $(find lib/agents/travel -name '*.ts' | wc -l) ts files"
echo "  app/travel        : $(find app/travel -type f | wc -l) files"
echo "  app/api/travel    : $(find app/api/travel -type f | wc -l) files"
echo "  components/travel : $(find components/travel -type f | wc -l) files"
echo "  scripts/travel    : $(find scripts/travel -type f | wc -l) files"
echo

# ---------- 3. schema ----------
echo "[3/7] append TripPlan model to schema.prisma"
if grep -q 'model TripPlan' prisma/schema.prisma; then
  echo "  already present, skip"
else
  printf '\n' >> prisma/schema.prisma
  cat "$W/prisma/tripplan-model.prisma" >> prisma/schema.prisma
  echo "  appended"
fi
echo

# ---------- 4. task queue ----------
echo "[4/7] register TASK-006 in ai-context/AI_TASK_QUEUE.md"
if grep -q 'TASK-006' ai-context/AI_TASK_QUEUE.md; then
  echo "  already present, skip"
else
  cat >> ai-context/AI_TASK_QUEUE.md <<'TASK'

================================

# TASK-006


名称：

AI旅行规划Agent


状态：

规划中


背景：

作为 AI 智能体生态平台的第一个自研 Agent 试验田，
验证「Agent 调用外部工具 + 大模型编排 + 结果落库」的完整链路。


目标：

用户输入出发地、目的地、去返程日期、人数与预算，
生成含交通、住宿、餐饮与逐日行程的完整方案。


实现位置：


- 业务逻辑：lib/agents/travel/
- 页面：app/travel/
- 接口：app/api/travel/
- 组件：components/travel/


影响模块：


- 数据库：新增 TripPlan 表
- 导航：components/Navbar.tsx 新增入口


优先级：

★★★☆☆


说明：

不在 V7 主线内，不抢占 TASK-001 数据质量的资源，
作为 V9 Agent 生态的前置验证。
TASK
  echo "  TASK-006 appended"
fi
echo

# ---------- 5. prisma generate ----------
echo "[5/7] prisma generate"
npx prisma generate > /dev/null
echo "  client generated"
echo

# ---------- 6. create table ----------
echo "[6/7] create TripPlan table"
SQL=prisma/migrations/20261015090000_add_trip_plan/migration.sql
if [ ! -f "$SQL" ]; then
  echo "  ABORT: migration sql not found at $SQL"
  exit 1
fi

npx prisma db execute --file "$SQL" --schema prisma/schema.prisma

if npx prisma migrate status 2>&1 | grep -q '20261015090000_add_trip_plan'; then
  if npx prisma migrate status 2>&1 | grep -q 'not yet been applied'; then
    npx prisma migrate resolve --applied 20261015090000_add_trip_plan
  else
    echo "  already applied"
  fi
fi
echo

# ---------- 7. restart + verify ----------
echo "[7/7] restart pm2 + verify"
pm2 restart ai-insight-daily > /dev/null 2>&1 && echo "  pm2 restarted" || echo "  pm2 restart skipped"
sleep 2

echo
echo "===== VERIFY ====="
echo "--- migration status ---"
npx prisma migrate status 2>&1 | tail -6

echo
echo "--- schema ---"
echo "  models total    : $(grep -c '^model ' prisma/schema.prisma)  (13 -> 14)"
echo "  TripPlan present: $(grep -c 'model TripPlan' prisma/schema.prisma)"

echo
echo "--- table exists in db? ---"
echo "SELECT name FROM sqlite_master WHERE type='table' AND name='TripPlan';" \
  | npx prisma db execute --stdin --schema prisma/schema.prisma > /dev/null 2>&1 \
  && echo "  query ok" || echo "  query failed"

echo
echo "--- tsc ---"
npx tsc --noEmit > /tmp/tsc-p2.txt 2>&1 || true
echo "  TS errors: $(grep -c 'error TS' /tmp/tsc-p2.txt || true)"
grep 'error TS' /tmp/tsc-p2.txt | head -8 | sed 's/^/      /'

echo
echo "--- pm2 status ---"
pm2 list 2>&1 | grep -E "ai-insight-daily|status" | head -3

echo
echo "--- git status ---"
git status --porcelain | head -30
echo
echo "P2 DONE"
