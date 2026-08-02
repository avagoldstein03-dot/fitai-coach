import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  waist:  z.number().min(30).max(250),
  chest:  z.number().min(50).max(250),
  hips:   z.number().min(30).max(250),
  neck:   z.number().min(20).max(100),
  thighs: z.number().min(20).max(150).optional(),
  arms:   z.number().min(10).max(100).optional(),
});

// U.S. Navy body fat formula — coefficients are calibrated for inches, so cm inputs
// (how everything is stored internally) must be converted before applying them.
function navyBodyFat(
  sex: string,
  waistCm: number,
  neckCm: number,
  heightCm: number,
  hipsCm?: number
): number {
  const CM_TO_IN = 1 / 2.54;
  const waist = waistCm * CM_TO_IN;
  const neck = neckCm * CM_TO_IN;
  const height = heightCm * CM_TO_IN;
  const hips = hipsCm !== undefined ? hipsCm * CM_TO_IN : undefined;

  if (sex === "female" && hips !== undefined) {
    return (
      163.205 * Math.log10(waist + hips - neck) -
      97.684 * Math.log10(height) -
      78.387
    );
  }
  return 86.01 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST", "GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, height: true, sex: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    // GET — return current manual measurement
    if (req.method === "GET") {
      const measurement = await prisma.manualMeasurement.findUnique({
        where: { userId: user.id },
      });
      return sendSuccess(res, { measurement });
    }

    // POST — save/update measurement and generate assessment
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        "validation_error",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        400
      );
    }

    const { waist, chest, hips, neck, thighs, arms } = parsed.data;

    let estimatedBodyFat: number | null = null;
    if (user.height && neck !== undefined) {
      try {
        estimatedBodyFat = navyBodyFat(user.sex ?? "male", waist, neck, user.height, hips);
        estimatedBodyFat = Math.max(3, Math.min(60, estimatedBodyFat));
        estimatedBodyFat = Math.round(estimatedBodyFat * 10) / 10;
      } catch {
        estimatedBodyFat = null;
      }
    }

    const measurement = await prisma.manualMeasurement.upsert({
      where: { userId: user.id },
      create: { userId: user.id, waist, neck, hips, chest, thighs, arms, estimatedBodyFat },
      update: { waist, neck, hips, chest, thighs, arms, estimatedBodyFat },
    });

    // Keep a single manual-measurement-derived assessment per user in sync
    // (scanId: null distinguishes it from photo-scan assessments) rather than
    // creating a new orphaned row on every re-save.
    const assessmentData = {
      bodyComposition: {
        build: estimatedBodyFat != null ? `${estimatedBodyFat}% body fat` : "Measurements logged",
      },
      posture: {},
      strengths: [],
      areasForImprovement: [],
      recommendations: {},
      summary:
        estimatedBodyFat != null
          ? `Estimated body fat ${estimatedBodyFat}% based on manual measurements (US Navy formula).`
          : "Manual measurements logged. Add a neck measurement to estimate body fat percentage.",
    };

    const existingAssessment = await prisma.bodyAssessment.findFirst({
      where: { userId: user.id, scanId: null },
    });

    const assessment = existingAssessment
      ? await prisma.bodyAssessment.update({
          where: { id: existingAssessment.id },
          data: assessmentData,
        })
      : await prisma.bodyAssessment.create({
          data: { userId: user.id, ...assessmentData },
        });

    await prisma.analyticsEvent.create({
      data: {
        user: { connect: { clerkId: userId } },
        eventName: "manual_measurement_saved",
        eventProperties: { estimatedBodyFat },
      },
    });

    sendSuccess(
      res,
      { measurement, assessment, estimatedBodyFat },
      "Measurements saved successfully",
      201
    );
  } catch (error: any) {
    console.error("Manual measurement error:", error);
    return sendError(res, "server_error", error?.message ?? "Failed to save measurements", 500);
  }
}
