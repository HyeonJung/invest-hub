-- CreateEnum
CREATE TYPE "Broker" AS ENUM ('TOSS', 'NAMUH', 'KIWOOM', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('API', 'CSV', 'EXCEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BROKERAGE', 'PENSION_SAVINGS', 'ISA', 'MANUAL');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('API', 'CSV', 'EXCEL', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "broker" "Broker" NOT NULL,
    "connectionType" "ConnectionType" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerCredential" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "clientId" TEXT,
    "encryptedSecret" TEXT,
    "metadata" JSONB,

    CONSTRAINT "BrokerCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "broker" "Broker" NOT NULL,
    "externalAccountId" TEXT,
    "accountAlias" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL DEFAULT 'BROKERAGE',
    "currencyBase" TEXT NOT NULL DEFAULT 'KRW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Security" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isinCode" TEXT,
    "name" TEXT NOT NULL,
    "marketCountry" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "riskType" TEXT,

    CONSTRAINT "Security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "averagePurchasePrice" DECIMAL(18,4) NOT NULL,
    "marketPrice" DECIMAL(18,4) NOT NULL,
    "marketValue" DECIMAL(18,2) NOT NULL,
    "costAmount" DECIMAL(18,2) NOT NULL,
    "profitLoss" DECIMAL(18,2) NOT NULL,
    "profitLossRate" DECIMAL(10,4) NOT NULL,
    "annualDividendEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sourceType" "SourceType" NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "targetWeight" DECIMAL(8,4) NOT NULL,

    CONSTRAINT "PortfolioTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerCredential_connectionId_key" ON "BrokerCredential"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Security_symbol_marketCountry_key" ON "Security"("symbol", "marketCountry");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioTarget_userId_targetType_targetKey_key" ON "PortfolioTarget"("userId", "targetType", "targetKey");

-- AddForeignKey
ALTER TABLE "BrokerConnection" ADD CONSTRAINT "BrokerConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCredential" ADD CONSTRAINT "BrokerCredential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BrokerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentAccount" ADD CONSTRAINT "InvestmentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioTarget" ADD CONSTRAINT "PortfolioTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
