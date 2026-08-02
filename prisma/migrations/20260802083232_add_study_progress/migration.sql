-- CreateTable
CREATE TABLE "StudyProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemSlug" TEXT NOT NULL,
    "mastery" TEXT NOT NULL DEFAULT 'unseen',
    "notes" TEXT,
    "quizBestScore" INTEGER,
    "quizTotal" INTEGER,
    "quizAttempts" INTEGER NOT NULL DEFAULT 0,
    "rubricChecked" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rubricScore" INTEGER,
    "rubricMax" INTEGER,
    "repeatCount" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastMasteryAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyProgress_userId_itemType_idx" ON "StudyProgress"("userId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "StudyProgress_userId_itemType_itemSlug_key" ON "StudyProgress"("userId", "itemType", "itemSlug");

-- AddForeignKey
ALTER TABLE "StudyProgress" ADD CONSTRAINT "StudyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
