-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCheckpoint" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCheckpointRedemption" (
    "id" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statEventId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestCheckpointRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestCheckpoint_questId_code_key" ON "QuestCheckpoint"("questId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCheckpointRedemption_statEventId_key" ON "QuestCheckpointRedemption"("statEventId");

-- CreateIndex
CREATE INDEX "QuestCheckpointRedemption_userId_idx" ON "QuestCheckpointRedemption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCheckpointRedemption_checkpointId_userId_key" ON "QuestCheckpointRedemption"("checkpointId", "userId");

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCheckpoint" ADD CONSTRAINT "QuestCheckpoint_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCheckpointRedemption" ADD CONSTRAINT "QuestCheckpointRedemption_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "QuestCheckpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCheckpointRedemption" ADD CONSTRAINT "QuestCheckpointRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
