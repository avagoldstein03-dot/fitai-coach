import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendError, sendSuccess } from "@/lib/api-utils";
import { z } from "zod";
import { AIProviderRegistry } from "@/services/ai-registry";
import fs from "fs";
import path from "path";

function toDataUri(publicUrl: string): string {
  const filePath = path.join(process.cwd(), "public", publicUrl);
  const buffer = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

const RequestSchema = z.object({
  scanId: z.string().cuid(),
});

interface AssessmentResult {
  bodyComposition: {
    estimatedBodyFat: string;
    muscleDefinition: string;
    estimatedBMI: string;
  };
  posture: {
    spinalAlignment: string;
    shoulderAlignment: string;
    notes: string;
  };
  strengths: string[];
  areasForImprovement: string[];
  recommendations: {
    exercise: string[];
    nutrition: string[];
    recovery: string[];
  };
  summary: string;
}

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
      frontImageUrl: toDataUri(scan.frontImageUrl),
      sideImageUrl: toDataUri(scan.sideImageUrl),
      backImageUrl: toDataUri(scan.backImageUrl),
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

    return sendSuccess(res, {
      assessmentId: assessment.id,
      assessment,
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return sendError(res, "analysis_failed", error?.message ?? "Assessment analysis failed", 500);
  }
}
