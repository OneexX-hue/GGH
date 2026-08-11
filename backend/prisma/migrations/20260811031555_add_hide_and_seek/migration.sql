-- CreateTable
CREATE TABLE "HideAndSeekRound" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hiderUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HideAndSeekRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HideAndSeekFind" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "seekerUserId" TEXT NOT NULL,
    "statEventId" TEXT,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HideAndSeekFind_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HideAndSeekFind_statEventId_key" ON "HideAndSeekFind"("statEventId");

-- CreateIndex
CREATE INDEX "HideAndSeekFind_seekerUserId_idx" ON "HideAndSeekFind"("seekerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "HideAndSeekFind_roundId_seekerUserId_key" ON "HideAndSeekFind"("roundId", "seekerUserId");

-- AddForeignKey
ALTER TABLE "HideAndSeekRound" ADD CONSTRAINT "HideAndSeekRound_hiderUserId_fkey" FOREIGN KEY ("hiderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HideAndSeekRound" ADD CONSTRAINT "HideAndSeekRound_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HideAndSeekFind" ADD CONSTRAINT "HideAndSeekFind_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "HideAndSeekRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HideAndSeekFind" ADD CONSTRAINT "HideAndSeekFind_seekerUserId_fkey" FOREIGN KEY ("seekerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
