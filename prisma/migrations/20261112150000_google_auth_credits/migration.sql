-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('grant', 'reserve', 'release', 'confirm', 'adjust');

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('promo', 'subscription', 'topup');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleSub" TEXT,
ADD COLUMN     "name" TEXT;

-- DropTable
DROP TABLE "LoginToken";

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "creditType" "CreditType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "grantId" TEXT NOT NULL,
    "requestId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "requestText" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "blockCode" TEXT,
    "creditCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditEntry_idempotencyKey_key" ON "CreditEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditEntry_userId_kind_idx" ON "CreditEntry"("userId", "kind");

-- CreateIndex
CREATE INDEX "CreditEntry_grantId_idx" ON "CreditEntry"("grantId");

-- CreateIndex
CREATE INDEX "CreditEntry_requestId_idx" ON "CreditEntry"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationLog_requestId_key" ON "GenerationLog"("requestId");

-- CreateIndex
CREATE INDEX "GenerationLog_userId_createdAt_idx" ON "GenerationLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
