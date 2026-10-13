-- 旅行规划方案表
--
-- 说明：本迁移由 prisma migrate diff --from-empty --to-schema-datamodel 生成，
-- 语句与 schema.prisma 中的 TripPlan 模型逐字段对应。
--
-- 为什么用 CREATE TABLE / CREATE INDEX IF NOT EXISTS 而不是 Prisma 默认的裸建表：
-- 本项目的迁移历史不完整（NewsEvent、RSSLog、IndustryHotspot、HandoverPackage
-- 等表在迁移目录中没有对应文件，应是早期用 prisma db push 直接建的），
-- 因此 `prisma migrate dev` 无法通过影子库重放。这个表改为手工应用：
--   1. npx prisma db push                     同步表结构
--   2. npx prisma migrate resolve --applied <本次迁移名>   登记为已应用
-- 加 IF NOT EXISTS 是为了让上述两步无论先后都能重复执行而不报错。

CREATE TABLE IF NOT EXISTS "TripPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departDate" TEXT NOT NULL,
    "returnDate" TEXT NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "budget" INTEGER NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'comfort',
    "interests" TEXT,
    "planJson" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "quoteMode" TEXT NOT NULL DEFAULT 'estimate',
    "generatedByAI" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TripPlan_createdAt_idx" ON "TripPlan"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TripPlan_destination_createdAt_idx" ON "TripPlan"("destination", "createdAt");
