import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return sendError(res, "unauthorized", "Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        email: true,
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelledAt: true,
            stripeSubscriptionId: true,
            stripePriceId: true,
            stripeCustomerId: true,
          },
        },
      },
    });

    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    // Default to free tier if no subscription
    const subscription = user.subscription || {
      id: null,
      plan: "free",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: null,
      cancelledAt: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCustomerId: null,
    };

    const { tier } = await getUserSubscription(req);

    sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
        },
        subscription,
        tier,
      },
      "Subscription retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching subscription:", error);
    sendError(res, "server_error", "Failed to fetch subscription", 500);
  }
}
