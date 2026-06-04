-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('KAKAO', 'NAVER');

-- AlterTable
ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "profile_image_url" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "last_login_at" TIMESTAMP(3);

-- Preserve existing camelCase createdAt column while exposing it through Prisma's mapped field.
ALTER TABLE "User" RENAME COLUMN "createdAt" TO "created_at";

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "provider_email" TEXT,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_provider_user_id_key" ON "social_accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_user_id_provider_key" ON "social_accounts"("user_id", "provider");

-- CreateIndex
CREATE INDEX "social_accounts_user_id_idx" ON "social_accounts"("user_id");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
