import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import type { OnboardingStep2Request } from "@/types/index";
import { z } from "zod";

const step2Schema = z.object({
  primaryGoal: z.enum([
    "fat_loss",
    "muscle_gain",
    "recomposition",
    "athletic_performance",
    "general_health",
  ]),
  targetWeight: z.number().optional(),
  timeline: z.number().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return sendError(res, "unauthorized", "Unauthorized", 401);
    }

    const validationResult = step2Schema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, "validation_error", "Invalid request body", 400);
    }

    const data = validationResult.data as OnboardingStep2Request;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    // Create or update goal
    const goal = await prisma.goal.upsert({
      where: { userId: user.id },
      update: {
        primaryGoal: data.primaryGoal,
        targetWeight: data.targetWeight,
        timeline: data.timeline,
      },
      create: {
        userId: user.id,
        primaryGoal: data.primaryGoal,
        targetWeight: data.targetWeight,
        timeline: data.timeline,
      },
    });

    // Update user onboarding step
    await prisma.user.update({
      where: { clerkId: userId },
      data: { onboardingStep: 2 },
    });

    sendSuccess(
      res,
      {
        goalId: goal.id,
        onboardingStep: 2,
      },
      "Step 2 completed successfully",
      200
    );
  } catch (error) {
    console.error("Error in onboarding step 2:", error);
    sendError(res, "server_error", "Failed to complete onboarding step", 500);
  }
}
