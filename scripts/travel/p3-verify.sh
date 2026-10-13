#!/bin/bash
# P3 verification: confirm the generated plan was actually persisted,
# and inspect what the model produced.

P="$HOME/projects/ai-insight-daily"
cd "$P"

echo "########## P3 VERIFY ##########"
echo

node - <<'JS'
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("prisma/dev.db");

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='TripPlan'")
  .all();

console.log("TripPlan table exists :", tables.length > 0);

const count = db.prepare("SELECT COUNT(*) AS c FROM TripPlan").get();
console.log("TripPlan row count    :", count.c);
console.log();

const rows = db
  .prepare(
    "SELECT id, origin, destination, departDate, returnDate, adults, children, budget, style, quoteMode, generatedByAI, model, interests, overview, planJson FROM TripPlan ORDER BY id DESC LIMIT 3"
  )
  .all();

for (const r of rows) {
  console.log("=".repeat(70));
  console.log(`#${r.id}  ${r.origin} -> ${r.destination}`);
  console.log(`  dates      : ${r.departDate} ~ ${r.returnDate}`);
  console.log(`  party      : adults=${r.adults} children=${r.children}`);
  console.log(`  budget     : ${r.budget} (${r.style})`);
  console.log(`  quoteMode  : ${r.quoteMode}`);
  console.log(`  AI         : ${r.generatedByAI}  model=${r.model ?? "-"}`);
  console.log(`  interests  : ${r.interests ?? "-"}`);

  let plan = null;
  try {
    plan = JSON.parse(r.planJson);
  } catch (e) {
    console.log("  !! planJson parse failed:", e.message);
    continue;
  }

  const sum = plan.budget.categories.reduce((a, c) => a + c.amount, 0);
  console.log(`  days       : ${plan.itinerary.length} / planned ${plan.duration.days}`);
  console.log(`  budget sum : ${sum} / total ${plan.budget.total}  ${sum === plan.budget.total ? "OK" : "MISMATCH"}`);
  console.log(`  overview   : ${String(plan.overview).slice(0, 90)}...`);
  console.log();
  console.log("  --- budget allocation ---");
  for (const c of plan.budget.categories) {
    console.log(`    ${String(c.label).padEnd(6)} ${String(c.amount).padStart(7)}  ${String(Math.round(c.ratio * 100)).padStart(3)}%`);
  }
  console.log();
  console.log("  --- itinerary ---");
  for (const d of plan.itinerary) {
    console.log(`    Day ${d.day} ${d.date} ${d.theme}  cost=${d.estimatedCost}  acts=${d.activities.length}`);
    for (const a of d.activities) {
      console.log(`        ${a.startTime}-${a.endTime} [${a.kind}] ${a.title} (${a.estimatedCost})`);
    }
  }
  console.log();
  console.log("  --- warnings ---");
  for (const w of plan.warnings ?? []) console.log(`    - ${w}`);
}

db.close();
JS

echo
echo "--- migration status ---"
npx prisma migrate status 2>&1 | tail -5
echo
echo "DONE"
