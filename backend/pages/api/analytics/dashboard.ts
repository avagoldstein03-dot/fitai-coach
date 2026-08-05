import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { calculateStreak } from "@/lib/trends";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, weight: true, createdAt: true },
    });

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const streakLookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [
      mealsThisWeek,
      workoutsThisWeek,
      caloriesData,
      proteinData,
      latestAssessment,
      currentSubscription,
      recentWorkoutSessions,
      recentMeals,
      friendsConnected,
    ] = await Promise.all([
      prisma.meal.count({
        where: { userId: user.id, createdAt: { gte: weekAgo } },
      }),
      prisma.workoutSession.count({
        where: { userId: user.id, createdAt: { gte: weekAgo } },
      }),
      prisma.meal.findMany({
        where: { userId: user.id, createdAt: { gte: weekAgo } },
        select: { totalCalories: true, createdAt: true },
      }),
      prisma.meal.findMany({
        where: { userId: user.id, createdAt: { gte: weekAgo } },
        select: { totalProtein: true, createdAt: true },
      }),
      prisma.bodyAssessment.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          bodyComposition: true,
          createdAt: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { userId: user.id },
        select: { plan: true, status: true, currentPeriodEnd: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId: user.id, createdAt: { gte: streakLookback } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.meal.findMany({
        where: { userId: user.id, createdAt: { gte: streakLookback } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.friendConnection.count({ where: { userId: user.id } }),
    ]);

    const totalCaloriesThisWeek = caloriesData.reduce(
      (sum, m) => sum + (m.totalCalories || 0),
      0
    );
    const avgDailyCalories = mealsThisWeek
      ? Math.round(totalCaloriesThisWeek / 7)
      : 0;

    const totalProteinThisWeek = proteinData.reduce(
      (sum, m) => sum + (m.totalProtein || 0),
      0
    );
    const avgDailyProtein = mealsThisWeek
      ? Math.round(totalProteinThisWeek / 7)
      : 0;

    // Daily breakdown for chart data (last 7 days)
    const dailyStats = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dayCalories = caloriesData
        .filter((m) => m.createdAt.toISOString().split("T")[0] === dateStr)
        .reduce((sum, m) => sum + (m.totalCalories || 0), 0);
      const dayProtein = proteinData
        .filter((m) => m.createdAt.toISOString().split("T")[0] === dateStr)
        .reduce((sum, m) => sum + (m.totalProtein || 0), 0);
      return { date: dateStr, calories: dayCalories, protein: Math.round(dayProtein) };
    }).reverse();

    const workoutStreak = calculateStreak(recentWorkoutSessions);
    const mealStreak = calculateStreak(recentMeals);

    sendSuccess(res, {
      currentWeight: user.weight,
      physiqueNote: (latestAssessment?.bodyComposition as any)?.build ?? null,
      lastAssessmentDate: latestAssessment?.createdAt || null,
      thisWeek: {
        mealsLogged: mealsThisWeek,
        workoutsCompleted: workoutsThisWeek,
        avgDailyCalories,
        avgDailyProtein,
        totalCalories: Math.round(totalCaloriesThisWeek),
      },
      streaks: { workouts: workoutStreak, meals: mealStreak },
      friendsConnected,
      charts: { daily: dailyStats },
      subscription: {
        plan: currentSubscription?.plan || "free",
        status: currentSubscription?.status || "active",
        periodEnd: currentSubscription?.currentPeriodEnd || null,
      },
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    sendError(res, "server_error", "Failed to fetch dashboard data", 500);
  }
}
