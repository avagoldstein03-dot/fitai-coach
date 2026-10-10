import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { calorieGuardFor } from "@/lib/health-safety";
import {
  calculateTDEE,
  calculateMacros,
  isMenopauseAdjacent,
  LIFE_STAGE_PROTEIN_BUMP_G_PER_KG,
} from "@/lib/nutrition-targets";

// The maths moved to lib/nutrition-targets so the meal-plan endpoint can use
// the same function — it had its own flat 30 kcal/kg formula, and the Nutrition
// screen shows both figures at once. Re-exported here because other modules
// already import them from this path.
export { isMenopauseAdjacent, LIFE_STAGE_PROTEIN_BUMP_G_PER_KG, calculateMacros };

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
      calorieNote: macros.guardApplied ? calorieGuard!.reason : null,
    });
  } catch (error) {
    console.error("Nutrition targets error:", error);
    sendError(res, "server_error", "Failed to calculate nutrition targets", 500);
  }
}
