import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

const ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS || "").split(",").filter(Boolean);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    if (!ADMIN_CLERK_IDS.includes(userId)) {
      return sendError(res, "forbidden", "Admin access required", 403);
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisWeek,
      newUsersThisMonth,
      premiumSubscriptions,
      totalMealsScanned,
      totalWorkoutsLogged,
      totalChatMessages,
      totalAssessments,
      recentEvents,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.subscription.count({ where: { plan: "premium", status: "active" } }),
      prisma.meal.count(),
      prisma.workoutSession.count(),
      prisma.chatMessage.count(),
      prisma.bodyAssessment.count(),
      prisma.analyticsEvent.groupBy({
        by: ["eventName"],
        _count: { eventName: true },
        orderBy: { _count: { eventName: "desc" } },
        take: 20,
      }),
    ]);

    const completedOnboarding = await prisma.user.count({
      where: { onboardingCompleted: true },
    });

    sendSuccess(res, {
      users: {
        total: totalUsers,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        completedOnboarding,
        onboardingRate: totalUsers ? Math.round((completedOnboarding / totalUsers) * 100) : 0,
      },
      subscriptions: {
        premium: premiumSubscriptions,
        free: totalUsers - premiumSubscriptions,
        conversionRate: totalUsers ? Math.round((premiumSubscriptions / totalUsers) * 100) : 0,
      },
      usage: {
        totalMealsScanned,
        totalWorkoutsLogged,
        totalChatMessages,
        totalAssessments,
        avgMealsPerUser: totalUsers ? Math.round(totalMealsScanned / totalUsers) : 0,
      },
      eventBreakdown: recentEvents.map((e) => ({
        event: e.eventName,
        count: e._count.eventName,
      })),
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    sendError(res, "server_error", "Failed to fetch admin metrics", 500);
  }
}
