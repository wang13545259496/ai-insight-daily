#!/bin/bash

echo "====== AI Insight Daily Server Health ======"

echo ""
echo "[TIME]"
date

echo ""
echo "[PM2]"
pm2 status

echo ""
echo "[DISK]"
df -h /

echo ""
echo "[MEMORY]"
free -h

echo ""
echo "[DATABASE]"
ls -lh prisma/dev.db

echo ""
echo "[BACKUP]"
ls -lh backup/database | tail -5

echo ""
echo "==========================================="
