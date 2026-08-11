-- AlterTable
ALTER TABLE "User" ADD COLUMN "chatAlias" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_chatAlias_key" ON "User"("chatAlias");
