-- 实体关联三表（2026-10-16）
--
-- 用途：把公司/模型/产品/人物从新闻与事件中抽出来，建立可反向查询的关联。
-- 支撑两个能力：企业关联（某实体的全部动态）、趋势判断（同一实体的时间轴变化）。
--
-- 该迁移可重复执行：全部使用 IF NOT EXISTS。

-- 实体主表
CREATE TABLE IF NOT EXISTS "Entity" (
  "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name"        TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "aliases"     TEXT NOT NULL DEFAULT '|',
  "description" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'candidate',
  "mergedIntoId" INTEGER,
  "newsCount"   INTEGER NOT NULL DEFAULT 0,
  "eventCount"  INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt"  DATETIME,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Entity_name_type_key" ON "Entity"("name", "type");
CREATE INDEX IF NOT EXISTS "Entity_status_idx"    ON "Entity"("status");
CREATE INDEX IF NOT EXISTS "Entity_type_idx"      ON "Entity"("type");
CREATE INDEX IF NOT EXISTS "Entity_newsCount_idx" ON "Entity"("newsCount");

-- 新闻 ↔ 实体
CREATE TABLE IF NOT EXISTS "NewsEntity" (
  "id"        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "newsId"    INTEGER NOT NULL,
  "entityId"  INTEGER NOT NULL,
  "mentions"  INTEGER NOT NULL DEFAULT 1,
  "role"      TEXT NOT NULL DEFAULT 'background',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsEntity_newsId_fkey"   FOREIGN KEY ("newsId")   REFERENCES "News"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NewsEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "NewsEntity_newsId_entityId_key" ON "NewsEntity"("newsId", "entityId");
CREATE INDEX IF NOT EXISTS "NewsEntity_entityId_idx" ON "NewsEntity"("entityId");

-- 事件 ↔ 实体
CREATE TABLE IF NOT EXISTS "EventEntity" (
  "id"        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "eventId"   INTEGER NOT NULL,
  "entityId"  INTEGER NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventEntity_eventId_fkey"  FOREIGN KEY ("eventId")  REFERENCES "NewsEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id")    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventEntity_eventId_entityId_key" ON "EventEntity"("eventId", "entityId");
CREATE INDEX IF NOT EXISTS "EventEntity_entityId_idx" ON "EventEntity"("entityId");
