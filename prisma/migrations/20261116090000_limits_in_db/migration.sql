-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ActiveGeneration" (
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveGeneration_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "BlockedImage" (
    "hash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedImage_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveGeneration_requestId_key" ON "ActiveGeneration"("requestId");

-- CreateIndex
CREATE INDEX "ActiveGeneration_expiresAt_idx" ON "ActiveGeneration"("expiresAt");

-- CreateIndex
CREATE INDEX "BlockedImage_expiresAt_idx" ON "BlockedImage"("expiresAt");
