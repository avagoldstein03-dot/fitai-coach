import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendError, sendSuccess } from "@/lib/api-utils";
import { z } from "zod";
import { AIProviderRegistry } from "@/services/ai-registry";
import { getUserSubscription } from "@/lib/subscription-middleware";

const RequestSchema = z.object({
  base64: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return sendError(res, "invalid_method", "POST required", 405);
  }

  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return sendError(res, "unauthorized", "Authentication required", 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
    });

    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    // Check subscription limits
    const subscription = await getUserSubscription(req);
    if (subscription.limits.dailyFoodScans !== Infinity) {
      // Check daily scan limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const scansToday = await prisma.meal.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: today,
          },
        },
      });

      if (scansToday >= subscription.limits.dailyFoodScans) {
        return sendError(
          res,
          "daily_limit_reached",
          `Daily food scan limit reached (${subscription.limits.dailyFoodScans}/day)`,
          429
        );
      }
    }

    // Validate input
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "invalid_input", "base64 image required", 400);
    }

    const { base64 } = parsed.data;

    // Convert to data URL if not already
    const imageUrl = base64.startsWith("data:") 
      ? base64 
      : `data:image/jpeg;base64,${base64}`;

    // Get AI provider (routes to OpenAI for food analysis)
    const aiProvider = AIProviderRegistry.getProviderForTask("food_recognition");

    // Analyze food with OpenAI Vision
    const foodAnalysis = await aiProvider.analyzeFood(imageUrl);

    // Build individual food records — use detected items when available
    const foodsData = Array.isArray(foodAnalysis.items) && foodAnalysis.items.length > 0
      ? foodAnalysis.items.map((item) => ({
          foodName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          confidenceScore: foodAnalysis.confidenceScore,
        }))
      : [{
          foodName: foodAnalysis.foodName,
          quantity: foodAnalysis.quantity,
          unit: foodAnalysis.unit,
          calories: foodAnalysis.calories,
          protein: foodAnalysis.protein,
          carbs: foodAnalysis.carbs,
          fat: foodAnalysis.fat,
          fiber: foodAnalysis.fiber,
          confidenceScore: foodAnalysis.confidenceScore,
        }];

    // Create meal record
    const meal = await prisma.meal.create({
      data: {
        userId: user.id,
        mealType: "logged",
        totalCalories: foodAnalysis.calories,
        totalProtein: foodAnalysis.protein,
        totalCarbs: foodAnalysis.carbs,
        totalFat: foodAnalysis.fat,
        totalFiber: foodAnalysis.fiber,
        foods: {
          create: foodsData,
        },
      },
      include: {
        foods: true,
      },
    });

    return sendSuccess(res, {
      mealId: meal.id,
      foodAnalysis,
      meal: {
        id: meal.id,
        createdAt: meal.createdAt,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
        foods: meal.foods,
      },
    });
  } catch (error) {
    console.error("Food scan error:", error);

    if (error instanceof Error) {
      if (error.message.includes("API")) {
        return sendError(res, "ai_error", "Food analysis failed", 500);
      }
    }

    return sendError(res, "scan_failed", "Food scan failed", 500);
  }
}
