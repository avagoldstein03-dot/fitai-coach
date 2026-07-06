import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendError, sendSuccess } from "@/lib/api-utils";
import { uploadBase64ToS3 } from "@/lib/s3";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

interface UploadBody {
  base64: string;
  position: "front" | "side" | "back";
  scanId?: string;
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

    const { base64, position, scanId } = req.body as UploadBody;

    if (!base64) {
      return sendError(res, "missing_image", "base64 image data required", 400);
    }

    if (!["front", "side", "back"].includes(position)) {
      return sendError(res, "invalid_position", "Position must be front/side/back", 400);
    }

    let currentScan;
    if (scanId) {
      currentScan = await prisma.bodyScan.findUnique({ where: { id: scanId } });
      if (!currentScan || currentScan.userId !== user.id) {
        return sendError(res, "scan_not_found", "Scan not found", 404);
      }
    } else {
      currentScan = await prisma.bodyScan.create({
        data: {
          userId: user.id,
          frontImageUrl: null,
          sideImageUrl: null,
          backImageUrl: null,
          analysisStatus: "pending",
        },
      });
    }

    const publicUrl = await uploadBase64ToS3(base64, "body-scans", `${user.id}-${position}`);

    const updateData: Record<string, string> = {};
    updateData[`${position}ImageUrl`] = publicUrl;

    const updatedScan = await prisma.bodyScan.update({
      where: { id: currentScan.id },
      data: updateData,
    });

    return sendSuccess(res, {
      scanId: updatedScan.id,
      position,
      imageUrl: publicUrl,
      scan: {
        id: updatedScan.id,
        frontImageUrl: updatedScan.frontImageUrl,
        sideImageUrl: updatedScan.sideImageUrl,
        backImageUrl: updatedScan.backImageUrl,
        isComplete:
          !!updatedScan.frontImageUrl &&
          !!updatedScan.sideImageUrl &&
          !!updatedScan.backImageUrl,
      },
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return sendError(res, "upload_failed", error?.message ?? "Image upload failed", 500);
  }
}
