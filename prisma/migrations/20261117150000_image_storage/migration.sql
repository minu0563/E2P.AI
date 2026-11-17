-- AlterTable
ALTER TABLE "GenerationLog" ADD COLUMN "imageTier" TEXT,
ADD COLUMN "imageStoredAt" TIMESTAMP(3),
ADD COLUMN "imageExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "GenerationLog_imageTier_createdAt_idx" ON "GenerationLog"("imageTier", "createdAt");
