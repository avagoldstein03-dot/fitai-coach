import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { AIProviderRegistry } from "@/services/ai-registry";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { generateShoppingList, ShoppingListItem } from "@/lib/shopping-list";
import { isMenopauseAdjacent, LIFE_STAGE_PROTEIN_BUMP_G_PER_KG } from "./targets";
import { calorieGuardFor, guardCalories, goalForPlanner } from "@/lib/health-safety";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST", "GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    // GET: return current plan
    if (req.method === "GET") {
      const plan = await prisma.nutritionPlan.findUnique({
        where: { userId: (await prisma.user.findUnique({ where: { clerkId: userId } }))?.id },
      });

      if (!plan) return sendError(res, "not_found", "No meal plan found. Generate one first.", 404);

      return sendSuccess(res, { plan });
    }

    // POST: generate new plan
    // Independent of each other's results, so run concurrently instead of as
    // two sequential round trips.
    const [subscription, user] = await Promise.all([
      getUserSubscription(req),
      prisma.user.findUnique({ where: { clerkId: userId }, include: { goal: true } }),
    ]);

    if (!subscription.limits.unlimitedMealPlans) {
      return sendError(
        res,
        "subscription_required",
        "Upgrade to Premium to generate personalized meal plans",
        403
      );
    }

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    // Preserve any hand-added shopping-list items (and their checked state)
    // across a regenerate — they aren't derived from the meal plan, so
    // wiping them every time the user regenerates would be surprising.
    const existingPlan = await prisma.nutritionPlan.findUnique({ where: { userId: user.id } });
    const existingItems = (existingPlan?.shoppingList as { items?: ShoppingListItem[] } | null)?.items ?? [];
    const preservedCustomItems = existingItems.filter((item) => item.isCustom);

    const aiProvider = AIProviderRegistry.getProviderForTask("nutrition_planning");

    // The planner knew nothing about reported conditions, so the directives
    // that are specifically about food never reached the thing that generates
    // food. Two layers, because a prompt alone is not enough here: the goal
    // string is neutralised before it is asked for a deficit it must not build,
    // and the health context tells it why.
    const calorieGuard = calorieGuardFor(user.medicalConditions);
    const primaryGoal = user.goal?.primaryGoal || "general_health";

    const mealPlanResult = await aiProvider.generateMealPlan({
      goal: goalForPlanner(primaryGoal, calorieGuard),
      weight: user.weight || 70,
      activityLevel: user.activityLevel || "moderately_active",
      dietPreferences: user.dietPreferences || [],
      foodAllergies: user.foodAllergies || [],
      tier: subscription.tier,
      medicalConditions: user.medicalConditions,
      medicalNotes: user.medicalNotes ?? undefined,
      calorieNote: calorieGuard?.reason,
    });

    const shoppingListItems = [...generateShoppingList(mealPlanResult.days), ...preservedCustomItems];

    // Calculate targets inline.
    //
    // Note this is a different formula from the one in ./targets (a flat
    // 30 kcal/kg rather than Harris-Benedict), which predates this change and
    // is left alone here. It applies no deficit, so the guard below is a no-op
    // on today's numbers — it is applied anyway so that the invariant lives
    // with the arithmetic, and a later change to this formula cannot
    // reintroduce a deficit for someone whose conditions rule one out.
    const weight = user.weight || 70;
    const baseTarget = Math.round(weight * 30);
    const dailyCaloricTarget = guardCalories(baseTarget, baseTarget, calorieGuard);
    const proteinPerKg = 2 + (isMenopauseAdjacent(user.lifeStage) ? LIFE_STAGE_PROTEIN_BUMP_G_PER_KG : 0);
    const proteinTarget = Math.round(weight * proteinPerKg);
    const carbsTarget = Math.max(
      Math.round((dailyCaloricTarget * 0.4) / 4),
      calorieGuard?.minCarbGrams ?? 0
    );
    const fatsTarget = Math.round((dailyCaloricTarget * 0.25) / 9);
    const waterTarget = Math.round(weight * 35);

    const mealPlanData = { days: mealPlanResult.days } as unknown as Prisma.InputJsonValue;
    const shoppingListData = {
      items: shoppingListItems,
      generatedAt: new Date().toISOString(),
    } as unknown as Prisma.InputJsonValue;

    const plan = await prisma.nutritionPlan.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        dailyCaloricTarget,
        proteinTarget,
        carbsTarget,
        fatsTarget,
        waterTarget,
        mealPlan: mealPlanData,
        shoppingList: shoppingListData,
      },
      update: {
        dailyCaloricTarget,
        proteinTarget,
        carbsTarget,
        fatsTarget,
        waterTarget,
        mealPlan: mealPlanData,
        shoppingList: shoppingListData,
      },
    });

    await prisma.analyticsEvent.create({
      data: {
        user: { connect: { clerkId: userId } },
        eventName: "meal_plan_generated",
        eventProperties: {
          goal: user.goal?.primaryGoal,
          dietPreferences: user.dietPreferences,
        },
      },
    });

    sendSuccess(res, { plan }, "Meal plan generated successfully", 201);
  } catch (error: any) {
    console.error("Nutrition plan error:", error);
    sendError(res, "server_error", error?.message ?? "Failed to generate nutrition plan", 500);
  }
}
