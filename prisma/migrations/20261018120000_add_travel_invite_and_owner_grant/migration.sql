-- 旅行模块：一次性邀请码 + 行程归属
--
-- ownerGrant：记录方案是谁生成的，用于好友之间的行程隔离。
--   可为 null（改造前的历史数据），历史数据只有维护者能看到。
--
-- TravelInvite：一次性邀请码。
--   codeHash 存 SHA-256，不存明文 —— 库泄露时明文码可直接登录。
--   grantId 是随机十六进制，不是自增 id，避免 Cookie 里暴露好友数量。

-- AlterTable
ALTER TABLE "TripPlan" ADD COLUMN "ownerGrant" TEXT;

-- CreateTable
CREATE TABLE "TravelInvite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codeHash" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedIp" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "TravelInvite_codeHash_key" ON "TravelInvite"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "TravelInvite_grantId_key" ON "TravelInvite"("grantId");

-- CreateIndex
CREATE INDEX "TravelInvite_usedAt_idx" ON "TravelInvite"("usedAt");

-- CreateIndex
CREATE INDEX "TravelInvite_expiresAt_idx" ON "TravelInvite"("expiresAt");
