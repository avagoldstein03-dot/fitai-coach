/*
  Warnings:

  - You are about to drop the column `userContext` on the `ChatMessage` table. All the data in the column will be lost.
  - You are about to drop the column `mealTimings` on the `NutritionPlan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "userContext";

-- AlterTable
ALTER TABLE "NutritionPlan" DROP COLUMN "mealTimings";
