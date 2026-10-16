-- NewsEvent 表新增中文标题字段
--
-- 用途：事件标题由聚类时取首条新闻的标题，因此可能是英文。
-- 首页「今日重点」的卡片主标题就是事件标题，英文会直接暴露给读者。
--
-- 为空时页面回退到 title，不影响既有行为。

ALTER TABLE "NewsEvent" ADD COLUMN "titleZh" TEXT;
