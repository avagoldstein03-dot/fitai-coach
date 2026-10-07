import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

/**
 * Meals the user keeps, plus the ones they log often enough to be worth
 * offering back.
 *
 * GET returns both: explicitly saved meals, and recent meals they have not
 * logged today. Logging the same breakfast every morning should not mean
 * rebuilding it every morning, and most people never think to press "save" —
 * so the recent list does that work without being asked.
 */

const ItemSchema = z.object({
  foodName: z.string().trim().min(1).max(80),
  quantity: z.number().positive().max(10000).default(1),
  unit: z.string().trim().min(1).max(20).default("serving"),
  calories: z.number().min(0).max(10000),
  protein: z.number().min(0).max(1000).default(0),
  carbs: z.number().min(0).max(1000).default(0),
  fat: z.number().min(0).max(1000).default(0),
  fiber: z.number().min(0).max(1000).default(0),
});

const SaveSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
  items: z.array(ItemSchema).min(1).max(20),
});

const sum = (items: z.infer<typeof ItemSchema>[], key: "calories" | "protein" | "carbs" | "fat") =>
  items.reduce((a, i) => a + i[key], 0);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET", "POST", "DELETE"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    if (req.method === "POST") {
      const parsed = SaveSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "validation_error", "name and at least one item are required", 400);
      }
      const { name, mealType, items } = parsed.data;
      const saved = await prisma.savedMeal.create({
        data: {
          userId: user.id,
          name,
          mealType,
          items,
          totalCalories: sum(items, "calories"),
          totalProtein: sum(items, "protein"),
          totalCarbs: sum(items, "carbs"),
          totalFat: sum(items, "fat"),
        },
      });
      return sendSuccess(res, { saved }, "Meal saved", 201);
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id ?? "");
      if (!id) return sendError(res, "validation_error", "id is required", 400);
      // Scoped to the owner so an id from another account cannot be deleted.
      const { count } = await prisma.savedMeal.deleteMany({ where: { id, userId: user.id } });
      if (!count) return sendError(res, "not_found", "Saved meal not found", 404);
      return sendSuccess(res, { deleted: true }, "Saved meal removed");
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [saved, recent, loggedToday] = await Promise.all([
      prisma.savedMeal.findMany({
        where: { userId: user.id },
        orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.meal.findMany({
        where: { userId: user.id, createdAt: { gte: twoWeeksAgo, lt: startOfToday } },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { foods: true },
      }),
      prisma.meal.findMany({
        where: { userId: user.id, createdAt: { gte: startOfToday } },
        include: { foods: true },
      }),
    ]);

    // What was eaten today, so the same thing is not offered back as a suggestion.
    const eatenToday = new Set(
      loggedToday.map((m) => m.foods.map((f) => f.foodName).sort().join("|").toLowerCase())
    );

    const seen = new Set<string>();
    const suggestions = [];
    for (const meal of recent) {
      if (!meal.foods.length) continue;
      const key = meal.foods.map((f) => f.foodName).sort().join("|").toLowerCase();
      if (seen.has(key) || eatenToday.has(key)) continue;
      seen.add(key);
      suggestions.push({
        name: meal.notes || meal.foods.map((f) => f.foodName).join(", "),
        mealType: meal.mealType,
        lastLoggedAt: meal.createdAt,
        totalCalories: meal.totalCalories ?? 0,
        totalProtein: meal.totalProtein ?? 0,
        items: meal.foods.map((f) => ({
          foodName: f.foodName, quantity: f.quantity, unit: f.unit,
          calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber,
        })),
      });
      if (suggestions.length >= 8) break;
    }

    return sendSuccess(res, { saved, suggestions });
  } catch (error) {
    console.error("Saved meals error:", error);
    sendError(res, "server_error", "Failed to load saved meals", 500);
  }
}
