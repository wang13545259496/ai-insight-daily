#!/bin/bash
# AI Insight Daily - read-only project state check. NO modifications.
# Run:  bash /mnt/d/Backup/Documents/deepseek-harness/default-workspace/scripts/travel/check-project.sh

P="$HOME/projects/ai-insight-daily"
cd "$P" || { echo "project dir not found: $P"; exit 1; }

echo "############ 1. identity ############"
echo "pwd          : $(pwd)"
echo "package name : $(grep -m1 '\"name\"' package.json)"
echo "branch       : $(git branch --show-current)"
echo "HEAD         : $(git log --oneline -1)"
echo "uncommitted  : $(git status --porcelain | wc -l) entries"

echo
echo "############ 2. versions ############"
echo "node         : $(node -v)"
echo "npm          : $(npm -v)"
for p in next react prisma @prisma/client typescript openai; do
  v=$(node -p "require('./node_modules/$p/package.json').version" 2>/dev/null || echo "absent")
  echo "$(printf '%-14s' "$p"): $v"
done

echo
echo "############ 3. pm2 ############"
pm2 list 2>&1 | head -12

echo
echo "############ 4. database + migrations ############"
ls -la prisma/*.db 2>/dev/null
echo "--- migration dirs ---"
ls prisma/migrations 2>/dev/null | head -20
echo "--- applied in db ---"
npx prisma migrate status 2>&1 | tail -12

echo
echo "############ 5. git status (full) ############"
git status --porcelain

echo
echo "############ 6. schema models ############"
echo "line count: $(wc -l < prisma/schema.prisma)"
grep -c '^model ' prisma/schema.prisma
grep '^model ' prisma/schema.prisma
echo "--- TripPlan present? ---"
grep -c 'model TripPlan' prisma/schema.prisma
echo "--- last 8 lines ---"
tail -8 prisma/schema.prisma

echo
echo "############ 7. travel leftovers (untracked) ############"
for d in lib/travel app/travel app/api/travel components/travel scripts/travel; do
  if [ -d "$d" ]; then
    echo "  EXISTS $d  ($(find "$d" -type f | wc -l) files)"
  else
    echo "  absent $d"
  fi
done
echo "--- does lib/ai/client.ts exist? (what travel imports) ---"
if [ -f lib/ai/client.ts ]; then echo "  YES"; else echo "  NO  <-- travel code cannot compile without it"; fi

echo
echo "############ 8. navigation mechanism ############"
echo "--- app/layout.tsx (first 60 lines) ---"
head -60 app/layout.tsx 2>/dev/null
echo "--- any nav config file? ---"
find . -maxdepth 3 -name "navigation*" -not -path "./node_modules/*" 2>/dev/null
echo "--- components/ ---"
ls components | head -40

echo
echo "############ 9. ai call pattern ############"
echo "--- files referencing DeepSeek/openai ---"
grep -rln "DEEPSEEK_API_KEY\|api.deepseek.com\|new OpenAI" lib app scripts --include=*.ts --include=*.tsx 2>/dev/null | head -20

echo
echo "############ 10. agent platform surface ############"
ls -d app/agent* 2>/dev/null
echo "--- data/agents.ts length ---"
wc -l data/agents.ts 2>/dev/null

echo
echo "DONE"
