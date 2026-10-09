import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { calorieGuardFor, guardCalories, type CalorieGuard } from "@/lib/health-safety";

// Harris-Benedict equation for TDEE
function calculateTDEE(
  weight: number,
  height: number,
  age: number,
  sex: string,
  activityLevel: string
): number {
  let bmr: number;
  if (sex === "female") {
    bmr = 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
  } else {
    bmr = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  }

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
  };

  return bmr * (activityMultipliers[activityLevel] || 1.375);
}

// Anabolic resistance (reduced muscle-protein-synthesis efficiency) increases as estrogen
// declines, so a modest protein increase alongside resistance training is standard
// sports-nutrition guidance during this life stage.
export const LIFE_STAGE_PROTEIN_BUMP_G_PER_KG = 0.2;

export function isMenopauseAdjacent(stage?: string | null): boolean {
  return stage === "perimenopause" || stage === "menopause" || stage === "postmenopause";
}

export function calculateMacros(
  tdee: number,
  goal: string,
  weight: number,
  lifeStage?: string | null,
  /**
   * Reported health conditions. These cap how aggressive the target may be —
   * the formula below is otherwise purely mechanical, which meant a user who
   * had told the app she was pregnant still got tdee-500 if her goal said fat
   * loss. The coach would decline to help with that cut; this screen served it.
   */
  guard?: CalorieGuard | null
): { calories: number; protein: number; carbs: number; fat: number; water: number } {
  let calories: number;
  let proteinPerKg: number;

  switch (goal) {
    case "fat_loss":
      calories = tdee - 500;
      proteinPerKg = 2.2;
      break;
    case "muscle_gain":
      calories = tdee + 300;
      proteinPerKg = 2.0;
      break;
    case "recomposition":
      calories = tdee;
      proteinPerKg = 2.2;
      break;
    case "athletic_performance":
      calories = tdee + 200;
      proteinPerKg = 1.8;
      break;
    default:
      calories = tdee;
      proteinPerKg = 1.6;
  }

  if (isMenopauseAdjacent(lifeStage)) {
    proteinPerKg += LIFE_STAGE_PROTEIN_BUMP_G_PER_KG;
  }

  // Applied after the goal has had its say and before anything is derived from
  // the figure, so protein, fat and carbs are all computed from the guarded
  // number rather than the one the goal alone would have produced.
  calories = guardCalories(calories, tdee, guard ?? null);

  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  const water = Math.round(weight * 35); // ml

  return {
    calories: Math.round(calories),
    protein,
    // The 50g floor is a sanity bound, not a recommendation. Where a condition
    // makes cutting carbohydrate the specific risk, its own floor applies.
    carbs: Math.max(carbs, guard?.minCarbGrams ?? 50),
    fat,
    water,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { goal: true },
    });

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    if (!user.weight || !user.height || !user.age || !user.sex || !user.activityLevel) {
      return sendError(
        res,
        "incomplete_profile",
        "Complete your profile to get nutrition targets",
        400
      );
    }

    const tdee = calculateTDEE(
      user.weight,
      user.height,
      user.age,
      user.sex,
      user.activityLevel
    );

    const calorieGuard = calorieGuardFor(user.medicalConditions);
    const macros = calculateMacros(
      tdee,
      user.goal?.primaryGoal || "general_health",
      user.weight,
      user.lifeStage,
      calorieGuard
    );

    const mealTimings = [
      { meal: "Breakfast", time: "07:00", caloriePercent: 25 },
      { meal: "Lunch", time: "12:30", caloriePercent: 35 },
      { meal: "Snack", time: "16:00", caloriePercent: 10 },
      { meal: "Dinner", time: "19:00", caloriePercent: 30 },
    ];

    sendSuccess(res, {
      dailyCaloricTarget: macros.calories,
      proteinTarget: macros.protein,
      carbsTarget: macros.carbs,
      fatsTarget: macros.fat,
      waterTarget: macros.water,
      tdee: Math.round(tdee),
      mealTimings,
      goal: user.goal?.primaryGoal || "general_health",
      proteinAdjusted: isMenopauseAdjacent(user.lifeStage),
      // Surfaced so the app can say why the number is what it is. A target that
      // silently refuses to go where the user's goal points reads as a bug.
      calorieNote: calorieGuard?.reason ?? null,
    });
  } catch (error) {
    console.error("Nutrition targets error:", error);
    sendError(res, "server_error", "Failed to calculate nutrition targets", 500);
  }
}
