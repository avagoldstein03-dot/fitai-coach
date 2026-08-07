import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { z } from "zod";

const PRIMARY_GOALS = ["fat_loss", "muscle_gain", "recomposition", "athletic_performance", "general_health"] as const;

const patchSchema = z.object({
  primaryGoal: z.enum(PRIMARY_GOALS),
});

// Dedicated post-onboarding goal editor. Deliberately doesn't reuse
// /api/onboarding/step2 — that endpoint also resets onboardingStep, which is
// the wrong side effect for someone who already completed onboarding.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET", "PATCH"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    if (req.method === "PATCH") {
      const validation = patchSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, "validation_error", "Invalid request body", 400);
      }

      const goal = await prisma.goal.upsert({
        where: { userId: user.id },
        update: { primaryGoal: validation.data.primaryGoal },
        create: { userId: user.id, primaryGoal: validation.data.primaryGoal },
      });

      return sendSuccess(res, { goal }, "Goal updated successfully");
    }

    const goal = await prisma.goal.findUnique({ where: { userId: user.id } });
    return sendSuccess(res, { goal });
  } catch (error) {
    console.error("Goal error:", error);
    sendError(res, "server_error", "Failed to update goal", 500);
  }
}
