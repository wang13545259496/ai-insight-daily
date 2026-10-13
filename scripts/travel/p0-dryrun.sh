#!/bin/bash
# P0 dry-run: show what would be removed, verify sources exist in workspace.
# This script DELETES NOTHING. It only reports.

P="$HOME/projects/ai-insight-daily"
W=/mnt/d/Backup/Documents/deepseek-harness/default-workspace

cd "$P" || { echo "project dir not found"; exit 1; }

echo "########## P0 DRY RUN (nothing will be deleted) ##########"
echo

echo "=== A. travel files currently in the project (all untracked) ==="
for d in lib/travel app/travel app/api/travel components/travel scripts/travel; do
  if [ -d "$d" ]; then
    n=$(find "$d" -type f | wc -l)
    echo "  $d  ->  $n files"
  else
    echo "  $d  ->  absent"
  fi
done

echo
echo "=== B. migration dir in project ==="
if [ -d prisma/migrations/20261015090000_add_trip_plan ]; then
  echo "  present: prisma/migrations/20261015090000_add_trip_plan"
else
  echo "  absent"
fi
echo "  NOTE: this migration is NOT yet applied to dev.db"
echo "        (safe to keep, or remove together with the code)"

echo
echo "=== C. are these files still safe in the workspace? ==="
for d in lib/travel app/travel app/api/travel components/travel scripts/travel prisma/migrations/20261015090000_add_trip_plan; do
  if [ -e "$W/$d" ]; then
    n=$(find "$W/$d" -type f 2>/dev/null | wc -l)
    echo "  OK   workspace/$d  ($n files)"
  else
    echo "  MISS workspace/$d   <-- DO NOT DELETE, source would be lost"
  fi
done

echo
echo "=== D. backup files created by the failed sync attempts ==="
ls -lh _backup/ 2>/dev/null | grep -i travel

echo
echo "=== E. is any tracked file affected? ==="
echo "  (all travel paths are untracked, so deleting them touches no committed code)"
git status --porcelain | grep -i travel

echo
echo "=== F. confirm no tracked file imports the travel module ==="
echo "--- references to @/lib/travel or app/travel from TRACKED files ---"
git grep -n "lib/travel\|@/components/travel\|/travel" -- '*.ts' '*.tsx' 2>/dev/null | grep -v "^lib/travel/\|^app/travel/\|^app/api/travel/\|^components/travel/\|^scripts/travel/" || echo "  none  <-- removing travel is safe"

echo
echo "DONE (dry run, nothing changed)"
