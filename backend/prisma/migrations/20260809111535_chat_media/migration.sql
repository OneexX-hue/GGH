-- CreateEnum
CREATE TYPE "ChatMediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaAccessAction" AS ENUM ('VIEW', 'DOWNLOAD_ATTEMPT', 'SCREENSHOT_DETECTED');

-- CreateTable
CREATE TABLE "ChatMedia" (
    "id" TEXT NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "kind" "ChatMediaKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAccessLog" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "viewerUserId" TEXT NOT NULL,
    "action" "MediaAccessAction" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMedia_uploaderUserId_idx" ON "ChatMedia"("uploaderUserId");

-- CreateIndex
CREATE INDEX "MediaAccessLog_mediaId_idx" ON "MediaAccessLog"("mediaId");

-- CreateIndex
CREATE INDEX "MediaAccessLog_viewerUserId_idx" ON "MediaAccessLog"("viewerUserId");

-- AddForeignKey
ALTER TABLE "ChatMedia" ADD CONSTRAINT "ChatMedia_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAccessLog" ADD CONSTRAINT "MediaAccessLog_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "ChatMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAccessLog" ADD CONSTRAINT "MediaAccessLog_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
