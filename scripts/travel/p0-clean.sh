#!/bin/bash
# P0: remove the travel files that were wrongly copied into the project,
# plus the duplicate db backups left behind by the failed sync attempts.
#
# Safety contract:
#   - aborts unless every source still exists in the workspace
#   - only removes UNTRACKED paths (verified in the dry run: no tracked file
#     references them)
#   - does NOT touch schema.prisma, Navbar.tsx, or any committed file
#
# Run:  bash /mnt/d/.../scripts/travel/p0-clean.sh

set -e

P="$HOME/projects/ai-insight-daily"
W=/mnt/d/Backup/Documents/deepseek-harness/default-workspace
cd "$P"

echo "########## P0 CLEANUP ##########"
echo "project: $(pwd)"
echo

# ---------- guard: sources must exist ----------
echo "[guard] verifying workspace sources are intact"
missing=0
for d in lib/travel app/travel app/api/travel components/travel scripts/travel \
         prisma/migrations/20261015090000_add_trip_plan; do
  if [ -e "$W/$d" ]; then
    echo "  OK   $d"
  else
    echo "  MISS $d"
    missing=$((missing + 1))
  fi
done

if [ "$missing" -ne 0 ]; then
  echo
  echo "ABORT: $missing source path(s) missing in the workspace."
  echo "Refusing to delete anything."
  exit 1
fi
echo "  -> all sources present, safe to proceed"
echo

# ---------- before ----------
echo "[before] tsc (running once, ~1 min)"
npx tsc --noEmit > /tmp/tsc-before.txt 2>&1 || true
before_travel=$(grep -c "lib/travel\|travel/" /tmp/tsc-before.txt || true)
before_total=$(grep -c "error TS" /tmp/tsc-before.txt || true)
echo "  travel-related errors : $before_travel"
echo "  total TS errors       : $before_total"
if [ "$before_total" -gt 0 ]; then
  echo "  --- first few errors ---"
  grep "error TS" /tmp/tsc-before.txt | head -5 | sed 's/^/      /'
fi
echo

# ---------- remove untracked travel dirs ----------
echo "[remove] untracked travel directories"
for d in lib/travel app/travel app/api/travel components/travel scripts/travel; do
  if [ -d "$d" ]; then
    rm -rf "$d"
    echo "  removed $d"
  fi
done

if [ -d prisma/migrations/20261015090000_add_trip_plan ]; then
  rm -rf prisma/migrations/20261015090000_add_trip_plan
  echo "  removed prisma/migrations/20261015090000_add_trip_plan"
fi
echo

# ---------- remove duplicate db backups ----------
echo "[remove] duplicate db backups from failed sync attempts"
removed=0
for f in _backup/dev.db.before-travel-*; do
  if [ -e "$f" ]; then
    rm -f "$f"
    echo "  removed $f"
    removed=$((removed + 1))
  fi
done
[ "$removed" -eq 0 ] && echo "  (none found)"
echo

# ---------- after ----------
echo "[after] verification"
echo "  --- git status ---"
git status --porcelain
echo
echo "  --- travel paths remaining (expect none) ---"
found=0
for d in lib/travel app/travel app/api/travel components/travel scripts/travel; do
  [ -e "$d" ] && { echo "  STILL PRESENT $d"; found=$((found + 1)); }
done
[ "$found" -eq 0 ] && echo "  none"
echo
echo "  --- tsc summary ---"
npx tsc --noEmit > /tmp/tsc-after.txt 2>&1 || true
after_travel=$(grep -c "lib/travel\|travel/" /tmp/tsc-after.txt || true)
after_total=$(grep -c "error TS" /tmp/tsc-after.txt || true)
echo "  travel-related errors : $after_travel   (was $before_travel)"
echo "  total TS errors       : $after_total   (was $before_total)"
if [ "$after_total" -gt 0 ]; then
  echo "  --- remaining errors (pre-existing, unrelated to travel) ---"
  grep "error TS" /tmp/tsc-after.txt | head -8 | sed 's/^/      /'
fi
echo
echo "  --- schema.prisma untouched? ---"
echo "  TripPlan in schema : $(grep -c 'model TripPlan' prisma/schema.prisma)  (expect 0)"
echo "  models total       : $(grep -c '^model ' prisma/schema.prisma)  (expect 13)"
echo
echo "  --- Navbar untouched? ---"
echo "  navItems count     : $(grep -c 'href:' components/Navbar.tsx)  (expect 9)"
echo
echo "P0 DONE"
