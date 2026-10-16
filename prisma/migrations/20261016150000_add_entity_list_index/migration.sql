-- 实体列表页按 eventCount 排序（关联事件多的实体优先展示）。
-- 现有索引只有单列的 status，排序时仍要扫描；
-- 加复合索引让「status 过滤 + eventCount 排序」走同一棵索引树。
--
-- 使用 IF NOT EXISTS，该迁移可重复执行。

CREATE INDEX IF NOT EXISTS "Entity_status_eventCount_idx"
  ON "Entity"("status", "eventCount");
