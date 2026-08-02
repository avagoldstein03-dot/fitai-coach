import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendError, sendSuccess } from "@/lib/api-utils";
import { z } from "zod";

const QuerySchema = z.object({
  days: z.string().optional().default("7"),
  limit: z.string().optional().default("50"),
});

const FoodItemSchema = z.object({
  foodName: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().default("serving"),
  calories: z.number().min(0),
  protein: z.number().min(0).default(0),
  carbs: z.number().min(0).default(0),
  fat: z.number().min(0).default(0),
  fiber: z.number().min(0).default(0),
  sugar: z.number().min(0).optional(),
  saturatedFat: z.number().min(0).optional(),
  sodium: z.number().min(0).optional(),
  cholesterol: z.number().min(0).optional(),
});

const PatchSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
  items: z.array(FoodItemSchema).min(1),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "DELETE", "PATCH"].includes(req.method ?? "")) {
    return sendError(res, "invalid_method", "GET, DELETE, or PATCH required", 405);
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

  // PATCH — replace a meal's food items and recompute totals
  if (req.method === "PATCH") {
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

      const parsed = PatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          res,
          "validation_error",
          parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
          400
        );
      }

      const data = parsed.data;
      const totals = data.items.reduce(
        (sum, item) => ({
          calories: sum.calories + item.calories,
          protein: sum.protein + item.protein,
          carbs: sum.carbs + item.carbs,
          fat: sum.fat + item.fat,
          fiber: sum.fiber + item.fiber,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      );

      const [, updatedMeal] = await prisma.$transaction([
        prisma.foodItem.deleteMany({ where: { mealId: id } }),
        prisma.meal.update({
          where: { id },
          data: {
            mealType: data.mealType,
            totalCalories: totals.calories,
            totalProtein: totals.protein,
            totalCarbs: totals.carbs,
            totalFat: totals.fat,
            totalFiber: totals.fiber,
            foods: {
              create: data.items.map((item) => ({
                foodName: item.foodName,
                quantity: item.quantity,
                unit: item.unit,
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                fiber: item.fiber,
                sugar: item.sugar,
                saturatedFat: item.saturatedFat,
                sodium: item.sodium,
                cholesterol: item.cholesterol,
              })),
            },
          },
          include: { foods: true },
        }),
      ]);

      return sendSuccess(res, {
        mealId: updatedMeal.id,
        meal: {
          id: updatedMeal.id,
          mealType: updatedMeal.mealType,
          totalCalories: updatedMeal.totalCalories,
          totalProtein: updatedMeal.totalProtein,
          totalCarbs: updatedMeal.totalCarbs,
          totalFat: updatedMeal.totalFat,
          foods: updatedMeal.foods,
        },
      }, "Meal updated");
    } catch (error: any) {
      console.error("Meal update error:", error);
      return sendError(res, "update_failed", error?.message ?? "Failed to update meal", 500);
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
        mealType: meal.mealType,
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
