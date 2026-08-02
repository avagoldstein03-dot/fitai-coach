import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { AIProviderRegistry } from "@/services/ai-registry";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { generateShoppingList, ShoppingListItem } from "@/lib/shopping-list";

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
    const subscription = await getUserSubscription(req);
    if (!subscription.limits.unlimitedMealPlans) {
      return sendError(
        res,
        "subscription_required",
        "Upgrade to Premium to generate personalized meal plans",
        403
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { goal: true },
    });

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    // Preserve any hand-added shopping-list items (and their checked state)
    // across a regenerate — they aren't derived from the meal plan, so
    // wiping them every time the user regenerates would be surprising.
    const existingPlan = await prisma.nutritionPlan.findUnique({ where: { userId: user.id } });
    const existingItems = (existingPlan?.shoppingList as { items?: ShoppingListItem[] } | null)?.items ?? [];
    const preservedCustomItems = existingItems.filter((item) => item.isCustom);

    const aiProvider = AIProviderRegistry.getProviderForTask("nutrition_planning");

    const mealPlanResult = await aiProvider.generateMealPlan({
      goal: user.goal?.primaryGoal || "general_health",
      weight: user.weight || 70,
      activityLevel: user.activityLevel || "moderately_active",
      dietPreferences: user.dietPreferences || [],
      foodAllergies: user.foodAllergies || [],
    });

    const shoppingListItems = [...generateShoppingList(mealPlanResult.days), ...preservedCustomItems];

    // Calculate targets inline
    const weight = user.weight || 70;
    const dailyCaloricTarget = Math.round(weight * 30);
    const proteinTarget = Math.round(weight * 2);
    const carbsTarget = Math.round((dailyCaloricTarget * 0.4) / 4);
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
