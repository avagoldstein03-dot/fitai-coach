import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendError, sendSuccess } from "@/lib/api-utils";
import { z } from "zod";

const QuerySchema = z.object({
  days: z.string().optional().default("7"),
  limit: z.string().optional().default("50"),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "DELETE"].includes(req.method ?? "")) {
    return sendError(res, "invalid_method", "GET or DELETE required", 405);
  }

  // DELETE — remove a specific meal entry
  if (req.method === "DELETE") {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return sendError(res, "unauthorized", "Authentication required", 401);

      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return sendError(res, "missing_id", "Meal id required", 400);
      }

      const user = await prisma.user.findUnique({ where: { clerkId: auth.userId } });
      if (!user) return sendError(res, "user_not_found", "User not found", 404);

      const meal = await prisma.meal.findUnique({ where: { id } });
      if (!meal || meal.userId !== user.id) {
        return sendError(res, "not_found", "Meal not found", 404);
      }

      await prisma.meal.delete({ where: { id } });
      return sendSuccess(res, null, "Meal deleted");
    } catch (error) {
      console.error("Delete error:", error);
      return sendError(res, "delete_failed", "Failed to delete meal", 500);
    }
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

    // Validate query params
    const parsed = QuerySchema.safeParse(req.query);
    const { days, limit } = parsed.success 
      ? parsed.data 
      : { days: "7", limit: "50" };

    const daysNum = Math.min(parseInt(days) || 7, 90); // Max 90 days
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 results

    // Get meals from last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    startDate.setHours(0, 0, 0, 0);

    const meals = await prisma.meal.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        foods: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limitNum,
    });

    // Calculate daily totals
    const mealsByDate: Record<string, any> = {};

    meals.forEach((meal) => {
      const date = new Date(meal.createdAt).toISOString().split("T")[0];

      if (!mealsByDate[date]) {
        mealsByDate[date] = {
          date,
          meals: [],
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
          totalFiber: 0,
          mealCount: 0,
        };
      }

      mealsByDate[date].meals.push({
        id: meal.id,
        time: new Date(meal.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        createdAt: meal.createdAt,
        foods: meal.foods.map((f) => ({
          id: f.id,
          name: f.foodName,
          quantity: f.quantity,
          unit: f.unit,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          fiber: f.fiber,
          sugar: f.sugar,
          saturatedFat: f.saturatedFat,
          sodium: f.sodium,
          cholesterol: f.cholesterol,
        })),
        calories: meal.totalCalories,
        protein: meal.totalProtein,
        carbs: meal.totalCarbs,
        fat: meal.totalFat,
        fiber: meal.totalFiber,
      });

      mealsByDate[date].totalCalories += meal.totalCalories;
      mealsByDate[date].totalProtein += meal.totalProtein;
      mealsByDate[date].totalCarbs += meal.totalCarbs;
      mealsByDate[date].totalFat += meal.totalFat;
      mealsByDate[date].totalFiber += meal.totalFiber;
      mealsByDate[date].mealCount += 1;
    });

    const dailyData = Object.values(mealsByDate);

    // Calculate overall stats
    const totalCalories = dailyData.reduce((sum, day) => sum + day.totalCalories, 0);
    const totalProtein = dailyData.reduce((sum, day) => sum + day.totalProtein, 0);
    const totalCarbs = dailyData.reduce((sum, day) => sum + day.totalCarbs, 0);
    const totalFat = dailyData.reduce((sum, day) => sum + day.totalFat, 0);
    const totalMeals = meals.length;

    const stats = {
      periodDays: daysNum,
      totalMeals,
      totalCalories,
      averageCaloriesPerDay: dailyData.length > 0 ? Math.round(totalCalories / dailyData.length) : 0,
      totalProtein,
      totalCarbs,
      totalFat,
      averageProteinPerMeal: totalMeals > 0 ? Math.round(totalProtein / totalMeals) : 0,
    };

    return sendSuccess(res, {
      stats,
      dailyData,
      meals: {
        recent: meals.slice(0, 10),
        count: meals.length,
      },
    });
  } catch (error) {
    console.error("History fetch error:", error);
    return sendError(res, "fetch_failed", "Failed to fetch meal history", 500);
  }
}
