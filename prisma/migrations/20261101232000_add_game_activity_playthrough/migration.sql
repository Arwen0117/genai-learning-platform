CREATE TABLE "Playthrough" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "clientCorrelationId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Playthrough_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActivityAttempt" ADD COLUMN "playthroughId" TEXT;

CREATE INDEX "Playthrough_userId_lessonId_activityId_createdAt_idx"
  ON "Playthrough"("userId", "lessonId", "activityId", "createdAt");
CREATE INDEX "Playthrough_userId_lessonId_activityId_status_idx"
  ON "Playthrough"("userId", "lessonId", "activityId", "status");
CREATE INDEX "ActivityAttempt_playthroughId_idx"
  ON "ActivityAttempt"("playthroughId");

ALTER TABLE "Playthrough"
  ADD CONSTRAINT "Playthrough_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Playthrough"
  ADD CONSTRAINT "Playthrough_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityAttempt"
  ADD CONSTRAINT "ActivityAttempt_playthroughId_fkey"
  FOREIGN KEY ("playthroughId") REFERENCES "Playthrough"("id") ON DELETE SET NULL ON UPDATE CASCADE;
