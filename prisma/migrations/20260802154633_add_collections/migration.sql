-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceUrl" TEXT,
    "templateKey" TEXT,
    "dailyTarget" INTEGER,
    "weeklyTarget" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'problem',
    "externalId" TEXT,
    "dedupeKey" TEXT,
    "difficulty" TEXT,
    "topic" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "mastery" TEXT NOT NULL DEFAULT 'unseen',
    "notes" TEXT,
    "companies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "repeatCount" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_userId_archived_position_idx" ON "Collection"("userId", "archived", "position");

-- CreateIndex
CREATE INDEX "Collection_userId_templateKey_idx" ON "Collection"("userId", "templateKey");

-- CreateIndex
CREATE INDEX "Item_collectionId_position_idx" ON "Item"("collectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Item_collectionId_dedupeKey_key" ON "Item"("collectionId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ItemProgress_userId_lastPracticedAt_idx" ON "ItemProgress"("userId", "lastPracticedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ItemProgress_userId_itemId_key" ON "ItemProgress"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProgress" ADD CONSTRAINT "ItemProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProgress" ADD CONSTRAINT "ItemProgress_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
