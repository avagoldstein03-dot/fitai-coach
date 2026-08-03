import type { NextApiRequest } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "./prisma";

export type SubscriptionTier = "free" | "starter" | "pro" | "elite";

export interface FeatureLimit {
  dailyFoodScans: number;
  dailyCoachMessages: number;
  unlimitedMealPlans: boolean;
  unlimitedWorkouts: boolean;
  progressReviews: boolean;
  bodyScanDepth: "basic" | "full";
  supplements: boolean;
  formCheck: boolean;
  advancedAnalytics: boolean;
  groceryIntegration: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, FeatureLimit> = {
  free: {
    dailyFoodScans: 3,
    dailyCoachMessages: 5,
    unlimitedMealPlans: false,
    unlimitedWorkouts: false,
    progressReviews: false,
    bodyScanDepth: "basic",
    supplements: false,
    formCheck: false,
    advancedAnalytics: false,
    groceryIntegration: false,
  },
  starter: {
    dailyFoodScans: Infinity,
    dailyCoachMessages: Infinity,
    unlimitedMealPlans: true,
    unlimitedWorkouts: true,
    progressReviews: false,
    bodyScanDepth: "basic",
    supplements: false,
    formCheck: false,
    advancedAnalytics: false,
    groceryIntegration: false,
  },
  pro: {
    dailyFoodScans: Infinity,
    dailyCoachMessages: Infinity,
    unlimitedMealPlans: true,
    unlimitedWorkouts: true,
    progressReviews: true,
    bodyScanDepth: "full",
    supplements: true,
    formCheck: false,
    advancedAnalytics: false,
    groceryIntegration: true,
  },
  elite: {
    dailyFoodScans: Infinity,
    dailyCoachMessages: Infinity,
    unlimitedMealPlans: true,
    unlimitedWorkouts: true,
    progressReviews: true,
    bodyScanDepth: "full",
    supplements: true,
    formCheck: true,
    advancedAnalytics: true,
    groceryIntegration: true,
  },
};

function getTierFromPriceId(priceId: string | null | undefined): SubscriptionTier {
  if (!priceId) return "starter"; // unknown paid plan defaults to starter
  const eliteIds = [
    process.env.STRIPE_ELITE_MONTHLY_PRICE_ID,
    process.env.STRIPE_ELITE_WEEKLY_PRICE_ID,
    process.env.STRIPE_ELITE_ANNUAL_PRICE_ID,
  ].filter(Boolean);
  const proIds = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_WEEKLY_PRICE_ID,
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  ].filter(Boolean);
  const starterIds = [
    process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    process.env.STRIPE_STARTER_WEEKLY_PRICE_ID,
    process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
    process.env.STRIPE_PREMIUM_PRICE_ID, // legacy single-tier price
  ].filter(Boolean);

  if (eliteIds.includes(priceId)) return "elite";
  if (proIds.includes(priceId)) return "pro";
  if (starterIds.includes(priceId)) return "starter";
  return "starter"; // default any unrecognised paid plan to starter
}

export interface SubscriptionRecord {
  plan: string | null;
  status: string | null;
  currentPeriodEnd: Date | null;
  stripePriceId: string | null;
  tier: string | null;
}

// Pure tier resolution, usable outside a request context (e.g. bulk cron jobs
// iterating many users) where there's no NextApiRequest to call getAuth on.
export function resolveTier(
  subscription: SubscriptionRecord | null | undefined
): { isPremium: boolean; tier: SubscriptionTier } {
  const isPremium =
    subscription?.plan === "premium" &&
    subscription?.status === "active" &&
    !!subscription?.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) > new Date();

  const explicitTier = subscription?.tier;
  const isValidTier = (t: string | null | undefined): t is SubscriptionTier =>
    t === "starter" || t === "pro" || t === "elite";

  const tier: SubscriptionTier = isPremium
    ? isValidTier(explicitTier)
      ? explicitTier
      : getTierFromPriceId(subscription?.stripePriceId)
    : "free";

  return { isPremium, tier };
}

export async function getUserSubscription(req: NextApiRequest) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return { isPremium: false, tier: "free" as SubscriptionTier, limits: TIER_LIMITS.free };
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
            stripePriceId: true,
            tier: true,
          },
        },
      },
    });

    if (!user) {
      return { isPremium: false, tier: "free" as SubscriptionTier, limits: TIER_LIMITS.free };
    }

    const { isPremium, tier } = resolveTier(user.subscription);

    return {
      userId: user.id,
      isPremium,
      tier,
      limits: TIER_LIMITS[tier],
      subscription: user.subscription,
    };
  } catch (error) {
    console.error("Error getting user subscription:", error);
    return { isPremium: false, tier: "free" as SubscriptionTier, limits: TIER_LIMITS.free };
  }
}

export async function checkFeatureAccess(
  req: NextApiRequest,
  feature: keyof FeatureLimit
): Promise<boolean> {
  const subscription = await getUserSubscription(req);
  const featureValue = subscription.limits[feature];
  if (typeof featureValue === "boolean") return featureValue;
  return true;
}
