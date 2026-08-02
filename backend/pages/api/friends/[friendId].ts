import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["DELETE"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const { friendId } = req.query;
    if (!friendId || typeof friendId !== "string") {
      return sendError(res, "missing_friend_id", "friendId is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    await prisma.$transaction([
      prisma.friendConnection.deleteMany({ where: { userId: user.id, friendId } }),
      prisma.friendConnection.deleteMany({ where: { userId: friendId, friendId: user.id } }),
    ]);

    return sendSuccess(res, null, "Removed");
  } catch (error) {
    console.error("Friend remove error:", error);
    sendError(res, "server_error", "Failed to remove friend", 500);
  }
}
