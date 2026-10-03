-- CreateTable
CREATE TABLE "BusinessOpportunity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "industry" TEXT NOT NULL,
    "opportunity" TEXT NOT NULL,
    "trend" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BusinessReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "businessId" INTEGER NOT NULL,
    "marketAnalysis" TEXT NOT NULL,
    "painPoints" TEXT NOT NULL,
    "aiSolution" TEXT NOT NULL,
    "productDesign" TEXT NOT NULL,
    "businessModel" TEXT NOT NULL,
    "riskAnalysis" TEXT NOT NULL,
    "startupAdvice" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessOpportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
