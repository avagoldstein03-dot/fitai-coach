import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendError, sendSuccess } from "@/lib/api-utils";
import { deleteS3Object } from "@/lib/s3";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "DELETE"].includes(req.method ?? "")) {
    return sendError(res, "invalid_method", "GET or DELETE required", 405);
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

    if (req.method === "DELETE") {
      const { scanId } = req.query;
      if (!scanId || typeof scanId !== "string") {
        return sendError(res, "missing_id", "scanId is required", 400);
      }

      const scan = await prisma.bodyScan.findUnique({ where: { id: scanId } });
      if (!scan || scan.userId !== user.id) {
        return sendError(res, "not_found", "Scan not found", 404);
      }

      for (const url of [scan.frontImageUrl, scan.sideImageUrl, scan.backImageUrl]) {
        if (url) await deleteS3Object(url);
      }
      // BodyAssessment cascades on scan delete (onDelete: Cascade in schema)
      await prisma.bodyScan.delete({ where: { id: scanId } });

      return sendSuccess(res, null, "Scan deleted");
    }

    // Get all scans and assessments for user
    const scans = await prisma.bodyScan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        assessment: true,
      },
    });

    // Format response
    const data = scans.map((scan) => ({
      scanId: scan.id,
      createdAt: scan.createdAt,
      status: scan.analysisStatus,
      images: {
        front: scan.frontImageUrl,
        side: scan.sideImageUrl,
        back: scan.backImageUrl,
      },
      isComplete:
        !!scan.frontImageUrl && !!scan.sideImageUrl && !!scan.backImageUrl,
      assessment: scan.assessment
        ? {
            id: scan.assessment.id,
            bodyComposition: scan.assessment.bodyComposition,
            posture: scan.assessment.posture,
            strengths: scan.assessment.strengths,
            areasForImprovement: scan.assessment.areasForImprovement,
            recommendations: scan.assessment.recommendations,
            summary: scan.assessment.summary,
            createdAt: scan.assessment.createdAt,
          }
        : null,
    }));

    return sendSuccess(res, {
      assessments: data,
      count: data.length,
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return sendError(res, "fetch_failed", "Failed to fetch assessments", 500);
  }
}
