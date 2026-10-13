#!/bin/bash
# P3: add the /travel entry to the navigation and verify the whole feature.
#
# Only one existing file is modified: components/Navbar.tsx
# (appends one item to the hardcoded navItems array, 9 -> 10)

set -e

P="$HOME/projects/ai-insight-daily"
STAMP=$(date +%Y%m%d-%H%M%S)

cd "$P"
echo "########## P3 NAV + VERIFY ##########"
echo "project: $(pwd)"
echo

# ---------- backup ----------
echo "[1/6] backup Navbar.tsx"
mkdir -p _backup
cp components/Navbar.tsx "_backup/Navbar.tsx.before-travel-$STAMP"
echo "  -> _backup/Navbar.tsx.before-travel-$STAMP"
echo

# ---------- insert nav item ----------
echo "[2/6] insert /travel into navItems"
if grep -q 'href: "/travel"' components/Navbar.tsx; then
  echo "  already present, skip"
else
  # Insert before the closing bracket of the navItems array.
  # The array ends with the "/trend/predict" entry followed by "];".
  python3 - <<'PY'
import re

path = "components/Navbar.tsx"
s = open(path, encoding="utf-8").read()

if 'href: "/travel"' in s:
    print("  already present")
    raise SystemExit(0)

# find "const navItems = [" ... "];"
m = re.search(r"(const navItems = \[)(.*?)(\n\];)", s, flags=re.S)
if not m:
    raise SystemExit("ABORT: could not locate navItems array")

entry = '\n\n  {\n    name: "旅行规划",\n    href: "/travel",\n  },\n'
s = s[:m.end(2)] + entry.rstrip("\n") + s[m.end(2):]
open(path, "w", encoding="utf-8").write(s)
print("  inserted")
PY
fi
echo

# ---------- show result ----------
echo "[3/6] navItems after change"
sed -n '/const navItems = \[/,/^\];/p' components/Navbar.tsx
echo "  href count: $(grep -c 'href:' components/Navbar.tsx)  (expect 10)"
echo

# ---------- typecheck ----------
echo "[4/6] tsc"
npx tsc --noEmit > /tmp/tsc-p3.txt 2>&1 || true
echo "  TS errors: $(grep -c 'error TS' /tmp/tsc-p3.txt || true)"
grep 'error TS' /tmp/tsc-p3.txt | head -8 | sed 's/^/      /'
echo

# ---------- build ----------
echo "[5/6] build"
npm run build > /tmp/build-p3.txt 2>&1 || true
if grep -q "Compiled successfully" /tmp/build-p3.txt; then
  echo "  build ok"
  grep -E "^\S*(├|└).*travel" /tmp/build-p3.txt | sed 's/^/      /'
else
  echo "  BUILD FAILED — last 20 lines:"
  tail -20 /tmp/build-p3.txt | sed 's/^/      /'
fi
echo

# ---------- restart + smoke test ----------
echo "[6/6] restart pm2 + smoke test"
pm2 restart ai-insight-daily > /dev/null 2>&1 && echo "  pm2 restarted"
sleep 3

echo "  --- HTTP checks ---"
for u in / /travel "/api/travel/plan?limit=3"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000$u" || echo "000")
  echo "    $code  $u"
done

echo
echo "  --- POST /api/travel/plan (生成一份方案) ---"
curl -s -X POST http://127.0.0.1:3000/api/travel/plan \
  -H "Content-Type: application/json" \
  -d '{"origin":"北京","destination":"三亚","departDate":"2026-12-10","returnDate":"2026-12-14","party":{"adults":2,"children":0},"budget":12000,"style":"comfort","interests":["美食"]}' \
  | head -c 400
echo
echo

echo "  --- TripPlan rows ---"
sqlite3 prisma/dev.db "SELECT id, origin, destination, budget, quoteMode, generatedByAI FROM TripPlan ORDER BY id DESC LIMIT 5;" 2>/dev/null \
  || npx prisma db execute --stdin --schema prisma/schema.prisma <<< "SELECT COUNT(*) FROM TripPlan;" >/dev/null 2>&1 && echo "  (sqlite3 unavailable, used prisma instead)"

echo
echo "--- git status ---"
git status --porcelain | head -30
echo
echo "P3 DONE"
