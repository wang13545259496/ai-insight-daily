#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DATE=$(date +"%Y-%m-%d_%H-%M-%S")

SOURCE="$PROJECT_DIR/prisma/dev.db"

BACKUP_DIR="$PROJECT_DIR/backup/database"

TARGET="$BACKUP_DIR/dev_$DATE.db"


cp "$SOURCE" "$TARGET"


echo "Database backup completed:"
echo "$TARGET"


find "$BACKUP_DIR" -name "dev_*.db" -type f -mtime +30 -delete
