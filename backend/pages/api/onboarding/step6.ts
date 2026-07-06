import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import type { OnboardingStep6Request } from "@/types/index";
import { z } from "zod";

const step6Schema = z.object({
  foodAllergies: z.array(z.string()),
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

    const validationResult = step6Schema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, "validation_error", "Invalid request body", 400);
    }

    const data = validationResult.data as OnboardingStep6Request;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        foodAllergies: data.foodAllergies,
        onboardingStep: 6,
      },
    });

    sendSuccess(
      res,
      { onboardingStep: 6 },
      "Step 6 completed successfully",
      200
    );
  } catch (error) {
    console.error("Error in onboarding step 6:", error);
    sendError(res, "server_error", "Failed to complete onboarding step", 500);
  }
}
