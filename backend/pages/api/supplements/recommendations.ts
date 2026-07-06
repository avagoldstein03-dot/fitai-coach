import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";

interface SupplementRule {
  name: string;
  category: string;
  reason: string;
  dosage: string;
  frequency: string;
  benefits: string[];
  dosageMin: string;
  dosageMax: string;
  unit: string;
  relevantGoals: string[];
  alwaysRecommend?: boolean;
}

const SUPPLEMENT_DATABASE: SupplementRule[] = [
  {
    name: "Creatine Monohydrate",
    category: "creatine",
    reason: "Supports strength and power output during high-intensity training",
    dosage: "5g",
    frequency: "daily",
    benefits: ["Increased strength", "Improved power output", "Enhanced muscle recovery", "Cognitive benefits"],
    dosageMin: "3",
    dosageMax: "5",
    unit: "g",
    relevantGoals: ["muscle_gain", "athletic_performance", "recomposition"],
  },
  {
    name: "Whey Protein",
    category: "protein_powder",
    reason: "Helps meet daily protein targets for muscle repair and growth",
    dosage: "25-30g per serving",
    frequency: "post-workout or as needed",
    benefits: ["Supports muscle protein synthesis", "Convenient protein source", "Rapid absorption"],
    dosageMin: "20",
    dosageMax: "40",
    unit: "g",
    relevantGoals: ["muscle_gain", "recomposition", "fat_loss"],
  },
  {
    name: "Vitamin D3",
    category: "vitamin_d",
    reason: "Most people are deficient in Vitamin D, which supports immune function, bone health, and mood",
    dosage: "2000 IU",
    frequency: "daily with a meal containing fat",
    benefits: ["Immune function", "Bone health", "Mood regulation", "Testosterone support"],
    dosageMin: "1000",
    dosageMax: "4000",
    unit: "IU",
    relevantGoals: ["general_health", "muscle_gain", "fat_loss", "athletic_performance", "recomposition"],
    alwaysRecommend: true,
  },
  {
    name: "Omega-3 Fish Oil",
    category: "fish_oil",
    reason: "Anti-inflammatory properties support recovery, heart health, and joint health",
    dosage: "2-3g EPA+DHA",
    frequency: "daily with food",
    benefits: ["Reduces inflammation", "Heart health", "Joint support", "Cognitive function"],
    dosageMin: "1",
    dosageMax: "3",
    unit: "g",
    relevantGoals: ["general_health", "athletic_performance", "fat_loss"],
    alwaysRecommend: true,
  },
  {
    name: "Magnesium Glycinate",
    category: "magnesium",
    reason: "Supports sleep quality, muscle recovery, and stress reduction",
    dosage: "300-400mg",
    frequency: "nightly before bed",
    benefits: ["Better sleep quality", "Muscle relaxation", "Stress reduction", "Blood sugar regulation"],
    dosageMin: "200",
    dosageMax: "400",
    unit: "mg",
    relevantGoals: ["general_health", "athletic_performance", "recomposition"],
    alwaysRecommend: true,
  },
  {
    name: "Electrolyte Mix",
    category: "electrolytes",
    reason: "Replenishes sodium, potassium, and magnesium lost during intense training",
    dosage: "1 serving",
    frequency: "during or after workouts",
    benefits: ["Hydration", "Prevents cramps", "Sustained energy", "Recovery support"],
    dosageMin: "1",
    dosageMax: "2",
    unit: "serving",
    relevantGoals: ["athletic_performance", "muscle_gain"],
  },
];

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
