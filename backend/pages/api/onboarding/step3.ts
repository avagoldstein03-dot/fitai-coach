import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import type { OnboardingStep3Request } from "@/types/index";
import { z } from "zod";

const step3Schema = z.object({
  activityLevel: z.enum([
    "sedentary",
    "lightly_active",
    "moderately_active",
    "very_active",
  ]),
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

    const validationResult = step3Schema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, "validation_error", "Invalid request body", 400);
    }

    const data = validationResult.data as OnboardingStep3Request;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        activityLevel: data.activityLevel,
        onboardingStep: 3,
      },
    });

    sendSuccess(
      res,
      { onboardingStep: 3 },
      "Step 3 completed successfully",
      200
    );
  } catch (error) {
    console.error("Error in onboarding step 3:", error);
    sendError(res, "server_error", "Failed to complete onboarding step", 500);
  }
}
