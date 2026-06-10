-- AlterEnum
ALTER TYPE "Broker" ADD VALUE 'UPBIT';

-- AlterTable
ALTER TABLE "BrokerConnection" ADD COLUMN     "lastPriceSyncedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "CryptoAsset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "nameKo" TEXT,
    "nameEn" TEXT,
    "logoUrl" TEXT,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(28,10) NOT NULL,
    "locked" DECIMAL(28,10) NOT NULL,
    "avgBuyPrice" DECIMAL(28,8) NOT NULL,
    "avgBuyPriceCurrency" TEXT NOT NULL,
    "currentPrice" DECIMAL(28,8) NOT NULL,
    "marketValueKrw" DECIMAL(18,2) NOT NULL,
    "costAmountKrw" DECIMAL(18,2) NOT NULL,
    "profitLossKrw" DECIMAL(18,2) NOT NULL,
    "profitLossRate" DECIMAL(10,4) NOT NULL,
    "priceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoCashBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(28,10) NOT NULL,
    "locked" DECIMAL(28,10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoCashBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CryptoAsset_market_key" ON "CryptoAsset"("market");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoHolding_connectionId_market_key" ON "CryptoHolding"("connectionId", "market");

-- CreateIndex
CREATE INDEX "CryptoHolding_userId_idx" ON "CryptoHolding"("userId");

-- CreateIndex
CREATE INDEX "CryptoHolding_assetId_idx" ON "CryptoHolding"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoCashBalance_connectionId_currency_key" ON "CryptoCashBalance"("connectionId", "currency");

-- CreateIndex
CREATE INDEX "CryptoCashBalance_userId_idx" ON "CryptoCashBalance"("userId");

-- AddForeignKey
ALTER TABLE "CryptoHolding" ADD CONSTRAINT "CryptoHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoHolding" ADD CONSTRAINT "CryptoHolding_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BrokerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoHolding" ADD CONSTRAINT "CryptoHolding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CryptoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoCashBalance" ADD CONSTRAINT "CryptoCashBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoCashBalance" ADD CONSTRAINT "CryptoCashBalance_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BrokerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
