-- 邀请码生成额度
--
-- 「每个邀请码最多生成 N 次」需要按码累计计数。
-- 放数据库而不是内存：内存计数在每次部署重启后清零，
-- 而部署很频繁，等于限流形同虚设。
--
-- 默认 0 —— 已有的码从零开始计，不追溯历史生成量。

-- AlterTable
ALTER TABLE "TravelInvite" ADD COLUMN "generations" INTEGER NOT NULL DEFAULT 0;
