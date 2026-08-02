-- AlterTable
ALTER TABLE "Progress" ADD COLUMN     "companies" TEXT[] DEFAULT ARRAY[]::TEXT[];
