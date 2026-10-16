-- News 表新增中文标题字段
--
-- 用途：英文来源（OpenAI 官方博客、TechCrunch AI、MIT News 等）的标题
-- 由模型生成中文标题后写入本字段，页面优先显示它，为空时回退到 title。
--
-- 为什么不直接改写 title：
--   英文原文需要保留，便于溯源与去重比对；且翻译可能失真，
--   保留原文才能在发现问题时对照。
--
-- 为什么可空：
--   中文来源无需翻译；arXiv 论文按约定跳过。这些记录的该字段保持 NULL，
--   页面读取时回退到 title，不影响既有行为。
--
-- 该迁移可重复执行：SQLite 不支持 ADD COLUMN IF NOT EXISTS，
-- 重复执行会报「duplicate column name」，此时忽略即可。

ALTER TABLE "News" ADD COLUMN "titleZh" TEXT;
