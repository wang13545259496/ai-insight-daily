#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="$PROJECT_DIR/prisma/dev.db"
BACKUP_DIR="$PROJECT_DIR/backup/database"
LOG_DIR="$PROJECT_DIR/logs"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
  echo "PASS  $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

warn() {
  echo "WARN  $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

fail() {
  echo "FAIL  $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

echo ""
echo "============================================================"
echo " AI Insight Daily - Production Health Check"
echo "============================================================"
echo ""

echo "[TIME]"
date
echo ""

echo "[1] WEBSITE"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:3000/ 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  pass "Website HTTP 200"
else
  fail "Website HTTP $HTTP_STATUS"
fi

echo ""

echo "[2] PM2"

PM2_APP_STATUS=$(pm2 jlist 2>/dev/null | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try {
    const apps=JSON.parse(data);
    const app=apps.find(x=>x.name==="ai-insight-daily");
    console.log(app ? app.pm2_env.status : "missing");
  } catch {
    console.log("error");
  }
});
' 2>/dev/null)

if [ "$PM2_APP_STATUS" = "online" ]; then
  pass "ai-insight-daily online"
else
  fail "ai-insight-daily status: ${PM2_APP_STATUS:-unknown}"
fi

PM2_LOGROTATE_STATUS=$(pm2 jlist 2>/dev/null | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try {
    const apps=JSON.parse(data);
    const app=apps.find(x=>x.name==="pm2-logrotate");
    console.log(app ? app.pm2_env.status : "missing");
  } catch {
    console.log("error");
  }
});
' 2>/dev/null)

if [ "$PM2_LOGROTATE_STATUS" = "online" ]; then
  pass "pm2-logrotate online"
else
  warn "pm2-logrotate status: ${PM2_LOGROTATE_STATUS:-unknown}"
fi

echo ""

echo "[3] DISK"

DISK_USAGE=$(df -P "$PROJECT_DIR" | awk 'NR==2 {gsub("%","",$5); print $5}')

if [ -n "$DISK_USAGE" ]; then
  if [ "$DISK_USAGE" -lt 80 ]; then
    pass "Disk usage ${DISK_USAGE}%"
  elif [ "$DISK_USAGE" -lt 90 ]; then
    warn "Disk usage ${DISK_USAGE}%"
  else
    fail "Disk usage ${DISK_USAGE}%"
  fi
else
  warn "Unable to read disk usage"
fi

echo ""

echo "[4] MEMORY"

MEMORY_USAGE=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')

if [ -n "$MEMORY_USAGE" ]; then
  if [ "$MEMORY_USAGE" -lt 80 ]; then
    pass "Memory usage ${MEMORY_USAGE}%"
  elif [ "$MEMORY_USAGE" -lt 90 ]; then
    warn "Memory usage ${MEMORY_USAGE}%"
  else
    fail "Memory usage ${MEMORY_USAGE}%"
  fi
else
  warn "Unable to read memory usage"
fi

echo ""

echo "[5] DATABASE"

if [ -f "$DB_FILE" ]; then
  DB_SIZE=$(du -h "$DB_FILE" | awk '{print $1}')
  pass "Database exists (${DB_SIZE})"
else
  fail "Database file missing"
fi

echo ""

echo "[6] TODAY PRODUCTION"

DB_RESULT=$(cd "$PROJECT_DIR" && node - <<'NODE'
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [
    news,
    analyzed,
    reports,
    pageViews,
    activeNews,
    activeEvents,
    opportunities,
    investments,
  ] = await Promise.all([
    prisma.news.count({
      where: {
        createdAt: {
          gte: start,
        },
      },
    }),

    prisma.news.count({
      where: {
        createdAt: {
          gte: start,
        },
        analysisStatus: "completed",
      },
    }),

    prisma.dailyReport.count({
      where: {
        createdAt: {
          gte: start,
        },
      },
    }),

    prisma.pageView.count({
      where: {
        createdAt: {
          gte: start,
        },
      },
    }),

    prisma.news.count({
      where: {
        dataStatus: "active",
      },
    }),

    prisma.newsEvent.count({
      where: {
        status: "active",
      },
    }),

    prisma.businessOpportunity.count(),

    prisma.investment.count(),
  ]);

  console.log(
    JSON.stringify({
      news,
      analyzed,
      reports,
      pageViews,
      activeNews,
      activeEvents,
      opportunities,
      investments,
    })
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
)

if [ $? -ne 0 ] || [ -z "$DB_RESULT" ]; then
  fail "Unable to read production database"
else
  TODAY_NEWS=$(echo "$DB_RESULT" | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try { console.log(JSON.parse(data).news); }
  catch { console.log("0"); }
});
')

  TODAY_AI=$(echo "$DB_RESULT" | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try { console.log(JSON.parse(data).analyzed); }
  catch { console.log("0"); }
});
')

  TODAY_REPORTS=$(echo "$DB_RESULT" | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try { console.log(JSON.parse(data).reports); }
  catch { console.log("0"); }
});
')

  TODAY_PAGEVIEWS=$(echo "$DB_RESULT" | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try { console.log(JSON.parse(data).pageViews); }
  catch { console.log("0"); }
});
')

  ACTIVE_NEWS=$(echo "$DB_RESULT" | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try { console.log(JSON.parse(data).activeNews); }
  catch { console.log("0"); }
});
')

  ACTIVE_EVENTS=$(echo "$DB_RESULT" | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try { console.log(JSON.parse(data).activeEvents); }
  catch { console.log("0"); }
});
')

  OPPORTUNITIES=$(echo "$DB_RESULT" | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try { console.log(JSON.parse(data).opportunities); }
  catch { console.log("0"); }
});
')

  INVESTMENTS=$(echo "$DB_RESULT" | node -e '
let data="";
process.stdin.on("data",d=>data+=d);
process.stdin.on("end",()=>{
  try { console.log(JSON.parse(data).investments); }
  catch { console.log("0"); }
});
')

  echo "  News today:              $TODAY_NEWS"
  echo "  AI analyzed today:       $TODAY_AI"
  echo "  Daily reports today:     $TODAY_REPORTS"
  echo "  PageViews today:         $TODAY_PAGEVIEWS"
  echo "  Active news:             $ACTIVE_NEWS"
  echo "  Active events:           $ACTIVE_EVENTS"
  echo "  Opportunities:            $OPPORTUNITIES"
  echo "  Investments:             $INVESTMENTS"
  echo ""

  if [ "$TODAY_NEWS" -gt 0 ]; then
    pass "Today's news production active"
  else
    warn "No news created today"
  fi

  if [ "$TODAY_AI" -gt 0 ]; then
    pass "Today's AI analysis active"
  else
    warn "No AI analysis completed today"
  fi

  if [ "$TODAY_REPORTS" -gt 0 ]; then
    pass "Today's DailyReport exists"
  else
    warn "No DailyReport created today"
  fi

  if [ "$TODAY_PAGEVIEWS" -gt 0 ]; then
    pass "PageView collection active"
  else
    warn "No PageView recorded today"
  fi
fi

echo ""

echo "[7] DATABASE BACKUP"

if [ -d "$BACKUP_DIR" ]; then
  LATEST_BACKUP=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "dev_*.db" -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -1)

  if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_FILE=$(echo "$LATEST_BACKUP" | cut -d' ' -f2-)
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
    BACKUP_TIME=$(stat -c "%y" "$BACKUP_FILE" | cut -d'.' -f1)

    echo "  Latest backup: $BACKUP_FILE"
    echo "  Size:          $BACKUP_SIZE"
    echo "  Time:          $BACKUP_TIME"

    BACKUP_AGE=$(( $(date +%s) - $(stat -c %Y "$BACKUP_FILE") ))

    if [ "$BACKUP_AGE" -lt 172800 ]; then
      pass "Recent database backup"
    elif [ "$BACKUP_AGE" -lt 259200 ]; then
      warn "Database backup is older than 48 hours"
    else
      fail "Database backup is older than 72 hours"
    fi
  else
    fail "No database backup found"
  fi
else
  fail "Backup directory missing"
fi

echo ""

echo "[8] CRON"

CRON_CONTENT=$(crontab -l 2>/dev/null || true)

if echo "$CRON_CONTENT" | grep -q "api/cron/daily"; then
  pass "Daily intelligence cron configured"
else
  fail "Daily intelligence cron missing"
fi

if echo "$CRON_CONTENT" | grep -q "backup-db.sh"; then
  pass "Database backup cron configured"
else
  fail "Database backup cron missing"
fi

echo ""

echo "[9] LOGS"

if [ -f "$LOG_DIR/daily-cron.log" ]; then
  DAILY_LOG_SIZE=$(du -h "$LOG_DIR/daily-cron.log" | awk '{print $1}')
  pass "Daily cron log exists (${DAILY_LOG_SIZE})"
else
  warn "Daily cron log not found"
fi

if [ -f "$BACKUP_DIR/backup.log" ]; then
  BACKUP_LOG_SIZE=$(du -h "$BACKUP_DIR/backup.log" | awk '{print $1}')
  pass "Backup log exists (${BACKUP_LOG_SIZE})"
else
  warn "Backup log not found yet"
fi

echo ""

echo "============================================================"
echo " SUMMARY"
echo "============================================================"
echo ""
echo "PASS: $PASS_COUNT"
echo "WARN: $WARN_COUNT"
echo "FAIL: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "SYSTEM STATUS: FAIL"
  echo ""
  echo "Production system requires attention."
  exit 1
elif [ "$WARN_COUNT" -gt 0 ]; then
  echo "SYSTEM STATUS: WARNING"
  echo ""
  echo "Production system is running, but review the warnings."
  exit 0
else
  echo "SYSTEM STATUS: HEALTHY"
  echo ""
  echo "AI Insight Daily production system is healthy."
  exit 0
fi
