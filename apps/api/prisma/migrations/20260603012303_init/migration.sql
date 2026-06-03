-- CreateTable
CREATE TABLE "MarketIndicator" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "change" DECIMAL(18,6) NOT NULL,
    "changeRate" DECIMAL(10,4) NOT NULL,
    "status" TEXT NOT NULL,
    "unit" TEXT,
    "source" TEXT NOT NULL,
    "refreshIntervalMs" INTEGER NOT NULL DEFAULT 60000,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketIndicator_symbol_key" ON "MarketIndicator"("symbol");
