-- AlterTable
ALTER TABLE "GenerationLog" ADD COLUMN "model" TEXT,
ADD COLUMN "aiCalls" INTEGER,
ADD COLUMN "inputTokens" INTEGER,
ADD COLUMN "outputTokens" INTEGER,
ADD COLUMN "costMicroUsd" INTEGER;

-- CreateTable
CREATE TABLE "AiUsage" (
    "day" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "generations" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "costMicroUsd" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("day")
);
