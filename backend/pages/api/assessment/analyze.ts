import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendError, sendSuccess } from "@/lib/api-utils";
import { z } from "zod";
import { AIProviderRegistry } from "@/services/ai-registry";
import { checkRateLimit } from "@/lib/rate-limit";
import { getUserSubscription } from "@/lib/subscription-middleware";

const RequestSchema = z.object({
  scanId: z.string().cuid(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return sendError(res, "invalid_method", "POST required", 405);
  }

  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return sendError(res, "unauthorized", "Authentication required", 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
    });

    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    const allowed = await checkRateLimit("assessment-analyze", auth.userId, 10, "1 h");
    if (!allowed) {
      return sendError(res, "rate_limited", "Too many requests, please slow down", 429);
    }

    // Validate input
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "invalid_input", "scanId required", 400);
    }

    const { scanId } = parsed.data;

    // Get scan
    const scan = await prisma.bodyScan.findUnique({
      where: { id: scanId },
    });

    if (!scan || scan.userId !== user.id) {
      return sendError(res, "scan_not_found", "Scan not found", 404);
    }

    // Verify all 3 images uploaded
    if (!scan.frontImageUrl || !scan.sideImageUrl || !scan.backImageUrl) {
      return sendError(
        res,
        "incomplete_scan",
        "All 3 photos required (front/side/back)",
        400
      );
    }

    // Get AI provider (routes to OpenAI for body analysis)
    const aiProvider = AIProviderRegistry.getProviderForTask("body_analysis");

    // Analyze body with OpenAI Vision
    const analysisResult = await aiProvider.analyzeBody({
      userId: user.id,
      frontImageUrl: scan.frontImageUrl,
      sideImageUrl: scan.sideImageUrl,
      backImageUrl: scan.backImageUrl,
      userHeight: user.height || undefined,
      userWeight: user.weight || undefined,
      userAge: user.age || undefined,
      userSex: user.sex || undefined,
    });

    // Create assessment record
    const assessment = await prisma.bodyAssessment.create({
      data: {
        userId: user.id,
        scanId: scan.id,
        bodyComposition: analysisResult.bodyComposition,
        posture: analysisResult.posture,
        strengths: analysisResult.strengths,
        areasForImprovement: analysisResult.areasForImprovement,
        recommendations: analysisResult.recommendations,
        summary: analysisResult.summary,
      },
    });

    // Update scan status
    await prisma.bodyScan.update({
      where: { id: scan.id },
      data: { analysisStatus: "completed" },
    });

    // Every tier gets a scan, but only "full" depth gets the complete breakdown —
    // the headline summary is what carries the marketing hook for everyone else.
    const { limits } = await getUserSubscription(req);
    const isFullDepth = limits.bodyScanDepth === "full";
    const bodyComposition = analysisResult.bodyComposition as Record<string, string>;
    const [headlineKey, headlineValue] = Object.entries(bodyComposition)[0] ?? [];

    const responseAssessment = isFullDepth
      ? assessment
      : {
          id: assessment.id,
          summary: assessment.summary,
          bodyComposition: headlineKey ? { [headlineKey]: headlineValue } : {},
          locked: true,
        };

    return sendSuccess(res, {
      assessmentId: assessment.id,
      assessment: responseAssessment,
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return sendError(res, "analysis_failed", error?.message ?? "Assessment analysis failed", 500);
  }
}
