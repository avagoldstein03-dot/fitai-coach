import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { AIProviderRegistry } from "@/services/ai-registry";
import { getUserSubscription, type SubscriptionTier } from "@/lib/subscription-middleware";

const FREE_DAILY_LIMIT = 5;

// Tier-aware keyword detection — reliable fallback that doesn't depend on the AI emitting a marker
function detectUpgradeNeeded(message: string, tier: SubscriptionTier): { needed: boolean; upgradeTo: string | null } {
  if (tier === "elite") return { needed: false, upgradeTo: null };
  const m = message.toLowerCase();

  // Elite-only: form check, live body scan, advanced analytics
  const eliteTopics = /form\s*(check|analysis|review)|video\s*analysis|live\s*(scan|body)|advanced\s*analytic/i;
  if (eliteTopics.test(m)) return { needed: true, upgradeTo: "elite" };

  // Pro-only: progress reviews, body scan/composition, supplements
  if (tier === "free" || tier === "starter") {
    const proTopics = /progress\s*review|body\s*(scan|composition|fat)|supplement|weekly\s*review|monthly\s*review/i;
    if (proTopics.test(m)) return { needed: true, upgradeTo: "pro" };
  }

  // Starter-only: workout programs, meal plans
  if (tier === "free") {
    const starterTopics = /workout\s*(plan|program|routine|schedule)|training\s*(plan|program|schedule)|meal\s*plan|diet\s*plan|exercise\s*program/i;
    if (starterTopics.test(m)) return { needed: true, upgradeTo: "starter" };
  }

  return { needed: false, upgradeTo: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const { message } = req.body;
    if (!message?.trim()) {
      return sendError(res, "validation_error", "message is required", 400);
    }

    // Enforce free-tier daily message limit
    const subscription = await getUserSubscription(req);
    if (!subscription.isPremium) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const messagesCount = await prisma.chatMessage.count({
        where: {
          user: { clerkId: userId },
          role: "user",
          createdAt: { gte: todayStart },
        },
      });

      if (messagesCount >= FREE_DAILY_LIMIT) {
        return sendError(
          res,
          "daily_limit_reached",
          `Free tier allows ${FREE_DAILY_LIMIT} messages per day. Upgrade to Premium for unlimited coaching.`,
          403
        );
      }
    }

    // Load full user context for the AI
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        goal: true,
        meals: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { foods: true },
        },
        workoutSessions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        bodyAssessments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    // Load last 10 messages for conversation history
    const recentMessages = await prisma.chatMessage.findMany({
      where: { user: { clerkId: userId } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    // Save user message
    await prisma.chatMessage.create({
      data: {
        user: { connect: { clerkId: userId } },
        role: "user",
        content: message,
      },
    });

    const aiProvider = AIProviderRegistry.getProviderForTask("chat");

    const rawResponse = await aiProvider.chat(message, {
      userId: user.id,
      isPremium: subscription.isPremium,
      tier: subscription.tier,
      userProfile: {
        name: user.name,
        age: user.age,
        sex: user.sex,
        height: user.height,
        weight: user.weight,
        activityLevel: user.activityLevel,
        fitnessExperience: user.fitnessExperience,
        dietPreferences: user.dietPreferences,
        foodAllergies: user.foodAllergies,
        latestAssessment: user.bodyAssessments[0] || null,
      },
      recentMeals: user.meals,
      recentWorkouts: user.workoutSessions,
      goals: user.goal ? [user.goal] : [],
    });

    // Strip any [UPGRADE:tier] marker the AI may have emitted
    const upgradeMatch = rawResponse.match(/\[UPGRADE:(\w+)\]\s*$/m);
    const response = rawResponse.replace(/\[UPGRADE:\w+\]\s*$/m, "").trimEnd();

    // Reliable fallback: keyword-detect the user's question against their tier
    const keywordDetection = detectUpgradeNeeded(message, subscription.tier);
    const requiresUpgrade = !!upgradeMatch || keywordDetection.needed;
    const upgradeTo = upgradeMatch?.[1] ?? keywordDetection.upgradeTo ?? null;

    // Save assistant message
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        user: { connect: { clerkId: userId } },
        role: "assistant",
        content: response,
        aiProvider: "openai",
      },
    });

    await prisma.analyticsEvent.create({
      data: {
        user: { connect: { clerkId: userId } },
        eventName: "coach_message_sent",
        eventProperties: { isPremium: subscription.isPremium },
      },
    });

    sendSuccess(res, {
      message: assistantMessage,
      response,
      requiresUpgrade,
      upgradeTo,
      conversationHistory: recentMessages,
    });
  } catch (error) {
    console.error("Coach chat error:", error);
    sendError(res, "server_error", "Failed to get coaching response", 500);
  }
}
