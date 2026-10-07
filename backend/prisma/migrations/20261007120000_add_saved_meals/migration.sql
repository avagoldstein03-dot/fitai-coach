-- Meals the user chose to keep, so they can be logged again without being
-- rebuilt. Stores a snapshot of foods and macros rather than referencing the
-- original Meal, which may be deleted later.
CREATE TABLE "SavedMeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mealType" TEXT NOT NULL DEFAULT 'snack',
    "items" JSONB NOT NULL,
    "totalCalories" DOUBLE PRECISION NOT NULL,
    "totalProtein" DOUBLE PRECISION NOT NULL,
    "totalCarbs" DOUBLE PRECISION NOT NULL,
    "totalFat" DOUBLE PRECISION NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedMeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedMeal_userId_lastUsedAt_idx" ON "SavedMeal"("userId", "lastUsedAt");

ALTER TABLE "SavedMeal" ADD CONSTRAINT "SavedMeal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
