-- Revisions: clearing a due item by going back over it without re-solving.
--
-- Purely additive. Every column is nullable or defaulted, so existing rows stay
-- valid and the previous release keeps working against this schema — which is
-- what makes it safe to migrate before deploying the code that uses it.

ALTER TABLE "ItemProgress"
  ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastRevisedAt" TIMESTAMP(3),
  ADD COLUMN "flaggedForReviewAt" TIMESTAMP(3);

ALTER TABLE "Collection"
  ADD COLUMN "revisionTargetPeriod" TEXT DEFAULT 'weekly',
  ADD COLUMN "revisionTargetValue" INTEGER;

-- Surfacing the due queue means filtering on these two per user, and the
-- existing index only covers lastPracticedAt.
CREATE INDEX "ItemProgress_userId_lastRevisedAt_idx"
  ON "ItemProgress"("userId", "lastRevisedAt");

CREATE INDEX "ItemProgress_userId_flaggedForReviewAt_idx"
  ON "ItemProgress"("userId", "flaggedForReviewAt");
