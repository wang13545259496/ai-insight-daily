#!/bin/bash
# Sync the travel planner feature from the DSH workspace into the Next.js project.
#
# Why this file exists: pasting a heredoc script through the
# PowerShell -> WSL boundary kept producing a stale script. This file is
# written with LF endings and no BOM, and is executed directly from /mnt/d,
# which avoids every quoting and encoding pitfall.
#
# Usage:
#   bash /mnt/d/Backup/Documents/deepseek-harness/default-workspace/scripts/travel/sync-to-project.sh
#
# What it does:
#   1. backs up dev.db, schema.prisma, navigation.ts into _backup/
#   2. copies the new travel directories (never overwrites existing user files)
#   3. appends the TripPlan model to prisma/schema.prisma (idempotent)
#   4. inserts the /travel nav entry right after primaryNav (idempotent)
#   5. runs prisma generate + db push
#   6. self-checks and prints git status

set -e

W=/mnt/d/Backup/Documents/deepseek-harness/default-workspace
P="$HOME/projects/ai-insight-daily"
STAMP=$(date +%Y%m%d-%H%M%S)

cd "$P"
echo "workdir: $(pwd)"
echo

echo "[1/6] backup"
mkdir -p _backup
cp prisma/dev.db "_backup/dev.db.before-travel-$STAMP"
cp prisma/schema.prisma "_backup/schema.prisma.before-travel-$STAMP"
cp config/navigation.ts "_backup/navigation.ts.before-travel-$STAMP"
echo "  -> _backup/ (db + schema + navigation)"
echo

echo "[2/6] copy new directories"
mkdir -p lib app/api components prisma/migrations
cp -r "$W/lib/travel" lib/
cp -r "$W/app/travel" app/
cp -r "$W/app/api/travel" app/api/
cp -r "$W/components/travel" components/
cp -r "$W/scripts/travel" scripts/
cp -r "$W/prisma/migrations/20261015090000_add_trip_plan" prisma/migrations/
echo "  lib/travel     : $(find lib/travel -name '*.ts' | wc -l) ts files"
echo "  app/travel     : $(find app/travel -type f | wc -l) files"
echo "  app/api/travel : $(find app/api/travel -type f | wc -l) files"
echo "  components     : $(find components/travel -type f | wc -l) files"
echo "  scripts/travel : $(find scripts/travel -type f | wc -l) files"
echo

echo "[3/6] append TripPlan model to schema.prisma"
if grep -q 'model TripPlan' prisma/schema.prisma; then
  echo "  already present, skip"
else
  printf '\n' >> prisma/schema.prisma
  cat "$W/prisma/tripplan-model.prisma" >> prisma/schema.prisma
  echo "  appended"
fi
echo

echo "[4/6] insert /travel nav entry"
if grep -q 'href: "/travel"' config/navigation.ts; then
  echo "  already present, skip"
else
  awk '
    !done && /^export const primaryNav/ { inarr = 1 }
    inarr && /^\];/ {
      print "  { href: \"/travel\", label: \"旅行规划\" },"
      inarr = 0
      done = 1
    }
    { print }
  ' config/navigation.ts > /tmp/nav.tmp
  mv /tmp/nav.tmp config/navigation.ts
  echo "  inserted"
  sed -n '/export const primaryNav/,/^\];/p' config/navigation.ts | sed 's/^/      /'
fi
echo

echo "[5/6] prisma generate + db push"
npx prisma generate > /dev/null && echo "  client generated"
npx prisma db push --skip-generate
echo

echo "[6/6] self-check"
ok=0
bad=0
for f in \
  lib/travel/planner.ts \
  lib/travel/budget.ts \
  lib/travel/validation.ts \
  lib/travel/amadeus.ts \
  app/travel/page.tsx \
  "app/travel/[id]/page.tsx" \
  components/travel/PlanView.tsx \
  components/travel/TripPlannerForm.tsx \
  app/api/travel/plan/route.ts \
  "app/api/travel/plan/[id]/route.ts" \
  scripts/travel/check-amap.ts \
  scripts/travel/check-amadeus.ts \
  prisma/migrations/20261015090000_add_trip_plan/migration.sql
do
  if [ -f "$f" ]; then
    ok=$((ok + 1))
  else
    echo "  MISS $f"
    bad=$((bad + 1))
  fi
done
echo "  files ok=$ok miss=$bad"
echo "  TripPlan in schema : $(grep -c 'model TripPlan' prisma/schema.prisma)"
echo "  /travel in nav     : $(grep -c 'href: \"/travel\"' config/navigation.ts)"
echo "  TripPlan columns   :"
sed -n '/^model TripPlan/,/^}/p' prisma/schema.prisma | head -12 | sed 's/^/      /'
echo

echo "===== git status ====="
git status --short | head -40
echo "DONE"
