import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import type { OnboardingStep1Request } from "@/types/index";
import { z } from "zod";

const step1Schema = z.object({
  name: z.string().min(1),
  age: z.number().min(13).max(120),
  sex: z.enum(["male", "female", "other"]),
  lifeStage: z.enum(["not_applicable", "perimenopause", "menopause", "postmenopause", "prefer_not_to_say"]).optional(),
  height: z.number().min(50).max(300), // cm
  weight: z.number().min(20).max(500), // kg
  language: z.string().optional(),
  unitSystem: z.enum(["imperial", "metric"]).optional(),
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

    console.log("Step1 body received:", JSON.stringify(req.body));
    // Validate request body
    const validationResult = step1Schema.safeParse(req.body);
    if (!validationResult.success) {
      console.error("Validation errors:", JSON.stringify(validationResult.error.issues));
      return sendError(
        res,
        "validation_error",
        validationResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", "),
        400
      );
    }

    const data = validationResult.data as OnboardingStep1Request;

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      // Fetch the real email from Clerk
      const clerkUser = await (await clerkClient()).users.getUser(userId);
      const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ?? `user_${userId}@fitai.local`;

      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email,
          name: data.name,
          age: data.age,
          sex: data.sex,
          lifeStage: data.lifeStage,
          height: data.height,
          weight: data.weight,
          language: data.language ?? "English",
          unitSystem: data.unitSystem ?? "imperial",
          onboardingStep: 1,
        },
      });
    } else {
      // Update existing user
      user = await prisma.user.update({
        where: { clerkId: userId },
        data: {
          name: data.name,
          age: data.age,
          sex: data.sex,
          lifeStage: data.lifeStage,
          height: data.height,
          weight: data.weight,
          language: data.language ?? "English",
          unitSystem: data.unitSystem ?? "imperial",
          onboardingStep: 1,
        },
      });
    }

    sendSuccess(
      res,
      {
        userId: user.id,
        onboardingStep: user.onboardingStep,
      },
      "Step 1 completed successfully",
      200
    );
  } catch (error: any) {
    console.error("Error in onboarding step 1:", error);
    sendError(res, "server_error", error?.message ?? "Failed to complete onboarding step", 500);
  }
}
