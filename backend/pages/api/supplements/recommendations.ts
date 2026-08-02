import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { SUPPLEMENT_DATABASE } from "@/lib/supplement-database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const subscription = await getUserSubscription(req);
    if (!subscription.limits.supplements) {
      return sendError(
        res,
        "subscription_required",
        "Upgrade to Premium for personalized supplement recommendations",
        403
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { goal: true },
    });

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const userGoal = user.goal?.primaryGoal || "general_health";
    const isDietVegan = user.dietPreferences?.includes("vegan");
    const isDietVegetarian = user.dietPreferences?.includes("vegetarian");

    const recommendations = SUPPLEMENT_DATABASE.filter((supp) => {
      // Skip fish oil for vegans/vegetarians
      if ((isDietVegan || isDietVegetarian) && supp.category === "fish_oil") return false;
      // Skip whey for vegans
      if (isDietVegan && supp.category === "protein_powder") return false;

      return supp.alwaysRecommend || supp.relevantGoals.includes(userGoal);
    }).map((supp) => ({
      name: supp.name,
      category: supp.category,
      reason: supp.reason,
      dosage: supp.dosage,
      frequency: supp.frequency,
      benefits: supp.benefits,
      dosageRange: `${supp.dosageMin}-${supp.dosageMax}${supp.unit}`,
      disclaimer: "This is a general recommendation. Consult a healthcare provider before starting any supplement.",
    }));

    await prisma.analyticsEvent.create({
      data: {
        user: { connect: { clerkId: userId } },
        eventName: "supplements_viewed",
        eventProperties: { goal: userGoal, recommendationCount: recommendations.length },
      },
    });

    sendSuccess(res, {
      recommendations,
      disclaimer: "Supplement recommendations are informational only. They do not treat, cure, or prevent any disease. Always consult a qualified healthcare professional.",
    });
  } catch (error) {
    console.error("Supplement recommendations error:", error);
    sendError(res, "server_error", "Failed to get supplement recommendations", 500);
  }
}
