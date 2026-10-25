-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailJob_sentAt_failedAt_availableAt_idx" ON "EmailJob"("sentAt", "failedAt", "availableAt");

