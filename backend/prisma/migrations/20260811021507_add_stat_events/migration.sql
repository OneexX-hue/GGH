-- CreateTable
CREATE TABLE "StatEvent" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatEvent_moduleKey_userId_idx" ON "StatEvent"("moduleKey", "userId");

-- CreateIndex
CREATE INDEX "StatEvent_moduleKey_createdAt_idx" ON "StatEvent"("moduleKey", "createdAt");

-- CreateIndex
CREATE INDEX "StatEvent_userId_idx" ON "StatEvent"("userId");

-- AddForeignKey
ALTER TABLE "StatEvent" ADD CONSTRAINT "StatEvent_moduleKey_fkey" FOREIGN KEY ("moduleKey") REFERENCES "ModuleDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatEvent" ADD CONSTRAINT "StatEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
