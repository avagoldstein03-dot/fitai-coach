import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { AIProviderRegistry } from "@/services/ai-registry";
import { getUserSubscription } from "@/lib/subscription-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const subscription = await getUserSubscription(req);
    if (!subscription.limits.progressReviews) {
      return sendError(
        res,
        "subscription_required",
        "Upgrade to Premium to get AI progress reviews",
        403
      );
    }

    const { period = "weekly" } = req.query;
    const days = period === "monthly" ? 30 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, weight: true },
    });

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const [meals, sessions, assessments] = await Promise.all([
      prisma.meal.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { totalCalories: true, totalProtein: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { exerciseName: true, completedSets: true, weight: true },
      }),
      prisma.bodyAssessment.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { estimatedBodyFatLow: true, estimatedBodyFatHigh: true },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
    ]);

    const bodyMetrics: Record<string, number> = {};
    if (assessments[0]) {
      bodyMetrics.latestBodyFat = assessments[0].estimatedBodyFatLow || 0;
    }
    if (assessments[1]) {
      bodyMetrics.previousBodyFat = assessments[1].estimatedBodyFatLow || 0;
    }

    const aiProvider = AIProviderRegistry.getProviderForTask("progress_review");

    const review = await aiProvider.generateProgressReview({
      userId: user.id,
      mealsLogged: meals.length,
      workoutsCompleted: sessions.length,
      weightChange: 0,
      bodyMetrics,
      period: period as string,
    });

    await prisma.analyticsEvent.create({
      data: {
        user: { connect: { clerkId: userId } },
        eventName: "progress_review_generated",
        eventProperties: { period, mealsLogged: meals.length, workoutsCompleted: sessions.length },
      },
    });

    sendSuccess(res, {
      period,
      stats: {
        mealsLogged: meals.length,
        workoutsCompleted: sessions.length,
        avgDailyCalories: meals.length
          ? Math.round(meals.reduce((s, m) => s + (m.totalCalories || 0), 0) / days)
          : 0,
        avgDailyProtein: meals.length
          ? Math.round(meals.reduce((s, m) => s + (m.totalProtein || 0), 0) / days)
          : 0,
      },
      review,
    });
  } catch (error) {
    console.error("Progress review error:", error);
    sendError(res, "server_error", "Failed to generate progress review", 500);
  }
}
