-- 事件表新增产业价值分字段
--
-- 用途：首页「今日重点」的排序依据，由 lib/ranking/industryScore.ts 计算
--
--   产业价值分 = 热度 + 企业权重 + 商业价值 + 投资价值 − 学术噪声
--
-- 背景：此前首页按 heatScore 排序，而 heatScore 只统计新闻数量与新近度，
-- 导致 arXiv 论文、开源项目更新等产出频繁的内容挤占首页焦点位。
--
-- 说明：允许为 NULL 以外的值，默认 0。历史数据由 refreshEventScores() 回填。
-- 该迁移可重复执行。

-- AlterTable
ALTER TABLE "NewsEvent" ADD COLUMN "industryScore" REAL NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsEvent_industryScore_idx" ON "NewsEvent"("industryScore");
