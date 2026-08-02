-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "targetPeriod" TEXT DEFAULT 'daily',
ADD COLUMN     "targetUnit" TEXT DEFAULT 'count',
ADD COLUMN     "targetValue" INTEGER;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "durationSeconds" INTEGER;

-- AlterTable
ALTER TABLE "ItemProgress" ADD COLUMN     "positionSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "watchedSeconds" INTEGER NOT NULL DEFAULT 0;
