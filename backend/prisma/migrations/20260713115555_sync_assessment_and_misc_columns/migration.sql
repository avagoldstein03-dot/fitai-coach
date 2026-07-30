-- DropForeignKey
ALTER TABLE "BodyScan" DROP CONSTRAINT "BodyScan_assessmentId_fkey";

-- AlterTable
ALTER TABLE "BodyAssessment" DROP COLUMN "aiAnalysis",
DROP COLUMN "aiProvider",
DROP COLUMN "assessmentType",
DROP COLUMN "confidenceScore",
DROP COLUMN "estimatedBodyFatHigh",
DROP COLUMN "estimatedBodyFatLow",
DROP COLUMN "muscleGroups",
DROP COLUMN "symmetry",
DROP COLUMN "weaknesses",
ADD COLUMN     "bodyComposition" JSONB NOT NULL,
ADD COLUMN     "recommendations" JSONB NOT NULL,
ADD COLUMN     "scanId" TEXT,
ADD COLUMN     "summary" TEXT NOT NULL,
DROP COLUMN "posture",
ADD COLUMN     "posture" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "BodyScan" DROP COLUMN "assessmentId",
DROP COLUMN "backPhotoUrl",
DROP COLUMN "frontPhotoUrl",
DROP COLUMN "photoUploadDate",
DROP COLUMN "sidePhotoUrl",
ADD COLUMN     "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "backImageUrl" TEXT,
ADD COLUMN     "frontImageUrl" TEXT,
ADD COLUMN     "sideImageUrl" TEXT;

-- AlterTable
ALTER TABLE "FoodItem" ADD COLUMN     "cholesterol" DOUBLE PRECISION,
ADD COLUMN     "saturatedFat" DOUBLE PRECISION,
ADD COLUMN     "sodium" DOUBLE PRECISION,
ADD COLUMN     "sugar" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "bodyGoalFocus" TEXT,
ADD COLUMN     "specificFocus" TEXT;

-- AlterTable
ALTER TABLE "WorkoutProgram" ADD COLUMN     "coachNote" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BodyAssessment_scanId_key" ON "BodyAssessment"("scanId");

-- AddForeignKey
ALTER TABLE "BodyAssessment" ADD CONSTRAINT "BodyAssessment_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "BodyScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

