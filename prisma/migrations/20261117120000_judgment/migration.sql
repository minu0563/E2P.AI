-- AlterTable
ALTER TABLE "GenerationLog" ADD COLUMN "imageHash" TEXT,
ADD COLUMN "imageType" TEXT,
ADD COLUMN "personCount" INTEGER,
ADD COLUMN "estimatedAge" INTEGER,
ADD COLUMN "ageAssessment" TEXT,
ADD COLUMN "minorCues" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "sexualContent" TEXT,
ADD COLUMN "requestLevel" TEXT,
ADD COLUMN "thirdPartyClaim" BOOLEAN,
ADD COLUMN "judgment" JSONB,
ADD COLUMN "falsePositive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "falsePositiveNote" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" TEXT;

-- CreateIndex
CREATE INDEX "GenerationLog_ageAssessment_createdAt_idx" ON "GenerationLog"("ageAssessment", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationLog_imageHash_idx" ON "GenerationLog"("imageHash");
