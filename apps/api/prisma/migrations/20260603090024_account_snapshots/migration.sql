-- AlterTable
ALTER TABLE "InvestmentAccount" ADD COLUMN     "snapshotMarketValue" DECIMAL(18,2),
ADD COLUMN     "snapshotProfitLoss" DECIMAL(18,2),
ADD COLUMN     "snapshotReturnRate" DECIMAL(10,4),
ADD COLUMN     "snapshotSource" TEXT,
ADD COLUMN     "snapshotSyncedAt" TIMESTAMP(3);
