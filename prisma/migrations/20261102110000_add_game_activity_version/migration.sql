-- CreateTable
CREATE TABLE "GameActivityVersion" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameActivityVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Playthrough" ADD COLUMN "publishedVersionId" TEXT,
ADD COLUMN "contentHash" TEXT;

-- CreateIndex
CREATE INDEX "GameActivityVersion_lessonId_activityId_createdAt_idx" ON "GameActivityVersion"("lessonId", "activityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameActivityVersion_lessonId_activityId_version_key" ON "GameActivityVersion"("lessonId", "activityId", "version");

-- CreateIndex
CREATE INDEX "Playthrough_publishedVersionId_idx" ON "Playthrough"("publishedVersionId");

-- AddForeignKey
ALTER TABLE "GameActivityVersion" ADD CONSTRAINT "GameActivityVersion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playthrough" ADD CONSTRAINT "Playthrough_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "GameActivityVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
