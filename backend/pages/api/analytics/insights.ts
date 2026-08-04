import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";

// Read-only: insights are generated once a week by the Sunday cron
// (backend/services/insights.ts) and just read here, not computed live —
// this endpoint is hit far more often than a batch job runs, so it must stay
// a cheap DB read with no AI call in the request path.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const subscription = await getUserSubscription(req);
    if (!subscription.limits.progressReviews) {
      return sendError(res, "subscription_required", "Upgrade to Premium to get weekly insights", 403);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const latest = await prisma.weeklyInsight.findFirst({
      where: { userId: user.id },
      orderBy: { weekOf: "desc" },
      select: { weekOf: true, insights: true },
    });

    if (!latest) {
      return sendSuccess(res, { weekOf: null, insights: null });
    }

    sendSuccess(res, { weekOf: latest.weekOf, insights: latest.insights });
  } catch (error) {
    console.error("Weekly insights error:", error);
    sendError(res, "server_error", "Failed to fetch weekly insights", 500);
  }
}
