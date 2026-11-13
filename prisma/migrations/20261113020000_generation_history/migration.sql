-- AlterTable
ALTER TABLE "GenerationLog" ADD COLUMN     "input" JSONB,
ADD COLUMN     "prompt" TEXT;
