import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { uploadBase64ToS3, deleteS3Object } from "@/lib/s3";

export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });
  if (!user) return sendError(res, "user_not_found", "User not found", 404);

  if (req.method === "GET") {
    const limit  = Math.min(Number(req.query.limit  ?? 20), 50);
    const offset = Number(req.query.offset ?? 0);

    const [photos, total] = await Promise.all([
      prisma.progressPhoto.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.progressPhoto.count({ where: { userId: user.id } }),
    ]);

    return sendSuccess(res, { photos, total, limit, offset });
  }

  if (req.method === "POST") {
    const { base64, photoType = "full_body", notes } = req.body ?? {};

    if (!base64) {
      return sendError(res, "missing_image", "base64 image data required", 400);
    }

    const validTypes = ["front", "side", "back", "full_body"];
    if (!validTypes.includes(photoType)) {
      return sendError(res, "invalid_type", `photoType must be one of: ${validTypes.join(", ")}`, 400);
    }

    const photoUrl = await uploadBase64ToS3(base64, "progress-photos", `${user.id}-${photoType}`);

    const photo = await prisma.progressPhoto.create({
      data: {
        userId: user.id,
        photoUrl,
        photoType,
        notes: notes ?? null,
      },
    });

    return sendSuccess(res, { photo }, "Photo uploaded successfully", 201);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return sendError(res, "missing_id", "Photo id required", 400);
    }

    const photo = await prisma.progressPhoto.findUnique({ where: { id } });
    if (!photo || photo.userId !== user.id) {
      return sendError(res, "not_found", "Photo not found", 404);
    }

    await deleteS3Object(photo.photoUrl);
    await prisma.progressPhoto.delete({ where: { id } });

    return sendSuccess(res, null, "Photo deleted");
  }

  return sendError(res, "method_not_allowed", "Method not allowed", 405);
}
