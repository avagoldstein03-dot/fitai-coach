import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";
import {
  buildWeightSeries,
  aggregateHealthMetrics,
  aggregateMacroTrend,
  computeWorkoutVolumeTrend,
  detectWorkoutPlateaus,
  diffBodyComposition,
} from "@/lib/trends";

const QuerySchema = z.object({
  range: z.enum(["30", "90"]).default("30"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const subscription = await getUserSubscription(req);
    if (!subscription.limits.advancedAnalytics) {
      return sendError(res, "subscription_required", "Upgrade to Elite to use this feature", 403);
    }

    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, "validation_error", "Invalid range", 400);
    }
    const rangeDays = Number(parsed.data.range);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const [weightLogs, healthRows, meals, workoutSessions, recentAssessments] = await Promise.all([
      prisma.weightLog.findMany({
        where: { userId: user.id, loggedAt: { gte: since } },
        select: { weight: true, loggedAt: true },
      }),
      prisma.healthMetric.findMany({
        where: { userId: user.id, date: { gte: since } },
        select: { date: true, steps: true, activeEnergyKcal: true, sleepMinutes: true, restingHeartRate: true },
      }),
      prisma.meal.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: {
          createdAt: true,
          totalCarbs: true,
          totalFat: true,
          totalFiber: true,
          foods: { select: { sugar: true, sodium: true, cholesterol: true } },
        },
      }),
      prisma.workoutSession.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { exerciseName: true, weight: true, completedReps: true, createdAt: true },
      }),
      prisma.bodyAssessment.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { bodyComposition: true },
      }),
    ]);

    const [latestAssessment, previousAssessment] = recentAssessments;
    const bodyCompositionDiffs = diffBodyComposition(
      latestAssessment?.bodyComposition as Record<string, unknown> | undefined,
      previousAssessment?.bodyComposition as Record<string, unknown> | undefined
    );

    sendSuccess(res, {
      range: rangeDays,
      weight: buildWeightSeries(weightLogs),
      health: aggregateHealthMetrics(healthRows),
      macros: aggregateMacroTrend(meals),
      workouts: {
        volume: computeWorkoutVolumeTrend(workoutSessions),
        plateaus: detectWorkoutPlateaus(workoutSessions, 3),
      },
      bodyComposition: { diffs: bodyCompositionDiffs },
    });
  } catch (error) {
    console.error("Advanced analytics error:", error);
    return sendError(res, "server_error", "Failed to fetch advanced analytics", 500);
  }
}
