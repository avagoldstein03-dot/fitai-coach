import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyCheer } from "@/services/notifications";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
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
      select: { id: true, name: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const connection = await prisma.friendConnection.findUnique({
      where: { userId_friendId: { userId: user.id, friendId } },
    });
    if (!connection) {
      return sendError(res, "not_friends", "You can only cheer a connected friend", 403);
    }

    const allowed = await checkRateLimit(`friend-cheer:${friendId}`, user.id, 1, "24 h");
    if (!allowed) {
      return sendError(res, "rate_limited", "You already cheered this friend today", 429);
    }

    await prisma.friendCheer.create({ data: { fromUserId: user.id, toUserId: friendId } });
    await notifyCheer(friendId, user.name);

    return sendSuccess(res, null, "Cheer sent");
  } catch (error) {
    console.error("Friend cheer error:", error);
    sendError(res, "server_error", "Failed to send cheer", 500);
  }
}
