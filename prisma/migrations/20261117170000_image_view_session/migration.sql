-- CreateTable
CREATE TABLE "ImageViewSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "imagesLoaded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ImageViewSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageViewSession_tokenHash_key" ON "ImageViewSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ImageViewSession_adminEmail_createdAt_idx" ON "ImageViewSession"("adminEmail", "createdAt");
