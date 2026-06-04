-- CreateEnum
CREATE TYPE "LogoSource" AS ENUM ('MANUAL', 'FINNHUB', 'LOGO_DEV', 'BRANDFETCH', 'FALLBACK');

-- AlterTable
ALTER TABLE "Security"
  ADD COLUMN "logo_url" TEXT,
  ADD COLUMN "company_domain" TEXT,
  ADD COLUMN "logo_source" "LogoSource",
  ADD COLUMN "logo_last_checked_at" TIMESTAMP(3),
  ADD COLUMN "logo_failed_at" TIMESTAMP(3);
