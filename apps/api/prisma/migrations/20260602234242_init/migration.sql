-- CreateTable
CREATE TABLE "CurrentPrice" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "marketCountry" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "priceKrw" DECIMAL(18,4) NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurrentPrice_symbol_marketCountry_key" ON "CurrentPrice"("symbol", "marketCountry");
