-- CreateEnum
CREATE TYPE "LprSubmissionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "LprSubmission" (
    "id" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "detectedPlate" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "LprSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "points" INTEGER,
    "statEventId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LprSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LprSubmission_statEventId_key" ON "LprSubmission"("statEventId");

-- CreateIndex
CREATE INDEX "LprSubmission_submittedByUserId_idx" ON "LprSubmission"("submittedByUserId");

-- CreateIndex
CREATE INDEX "LprSubmission_status_idx" ON "LprSubmission"("status");

-- AddForeignKey
ALTER TABLE "LprSubmission" ADD CONSTRAINT "LprSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LprSubmission" ADD CONSTRAINT "LprSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
