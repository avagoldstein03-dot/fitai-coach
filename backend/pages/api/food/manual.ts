import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendError, sendSuccess } from "@/lib/api-utils";
import { z } from "zod";

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

const RequestSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
  items: z.array(FoodItemSchema).min(1),
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

    const parsed = RequestSchema.safeParse(req.body);
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

    const meal = await prisma.meal.create({
      data: {
        userId: user.id,
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
    });

    return sendSuccess(res, {
      mealId: meal.id,
      meal: {
        id: meal.id,
        createdAt: meal.createdAt,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
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
      },
    }, "Food logged successfully", 201);
  } catch (error: any) {
    console.error("Manual food log error:", error);
    return sendError(res, "log_failed", error?.message ?? "Failed to log food", 500);
  }
}
