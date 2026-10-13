-- 旅行规划方案：新增需求指纹列
--
-- 目的：识别「同一需求重复提交」，命中时直接返回已有方案，
-- 避免重复消耗大模型与高德地图的调用配额。
--
-- 说明：fingerprint 允许为 NULL。SQLite 的唯一索引允许多个 NULL，
-- 因此历史记录（无指纹）不会冲突，可安全地在现有库上执行。
-- 索引用 IF NOT EXISTS，保证本迁移可重复执行。

-- AlterTable
ALTER TABLE "TripPlan" ADD COLUMN "fingerprint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TripPlan_fingerprint_key" ON "TripPlan"("fingerprint");
