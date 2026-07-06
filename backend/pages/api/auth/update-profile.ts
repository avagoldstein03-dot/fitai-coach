import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["PATCH"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const { weight, height, age, name } = req.body;

    const updateData: Record<string, any> = {};
    if (weight !== undefined) updateData.weight = Number(weight);
    if (height !== undefined) updateData.height = Number(height);
    if (age !== undefined) updateData.age = Number(age);
    if (name !== undefined) updateData.name = String(name);

    if (Object.keys(updateData).length === 0) {
      return sendError(res, "validation_error", "No valid fields provided", 400);
    }

    const user = await prisma.user.update({
      where: { clerkId: userId },
      data: updateData,
      select: { id: true, name: true, weight: true, height: true, age: true },
    });

    sendSuccess(res, user, "Profile updated successfully");
  } catch (error) {
    console.error("Update profile error:", error);
    sendError(res, "server_error", "Failed to update profile", 500);
  }
}
