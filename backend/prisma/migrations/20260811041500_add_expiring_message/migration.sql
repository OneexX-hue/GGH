-- CreateTable
CREATE TABLE "ExpiringMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "msgId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpiringMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpiringMessage_msgId_key" ON "ExpiringMessage"("msgId");

-- CreateIndex
CREATE INDEX "ExpiringMessage_expiresAt_idx" ON "ExpiringMessage"("expiresAt");
