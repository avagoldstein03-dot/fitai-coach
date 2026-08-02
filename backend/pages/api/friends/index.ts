import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { calculateStreak } from "@/lib/trends";
import { generateUniqueFriendCode } from "@/lib/friend-code";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, friendCode: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    // Lazily generate the user's own connect code on first visit
    if (!user.friendCode) {
      const code = await generateUniqueFriendCode(
        async (candidate) => !!(await prisma.user.findUnique({ where: { friendCode: candidate } }))
      );
      user = await prisma.user.update({
        where: { id: user.id },
        data: { friendCode: code },
        select: { id: true, friendCode: true },
      });
    }

    const connections = await prisma.friendConnection.findMany({
      where: { userId: user.id },
      include: { friend: { select: { id: true, name: true } } },
    });

    const streakLookback = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const friends = await Promise.all(
      connections.map(async (connection) => {
        const sessions = await prisma.workoutSession.findMany({
          where: { userId: connection.friendId, createdAt: { gte: streakLookback } },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
        });

        return {
          id: connection.friend.id,
          name: connection.friend.name,
          workoutStreak: calculateStreak(sessions),
          lastWorkoutDate: sessions[0]?.createdAt ?? null,
        };
      })
    );

    return sendSuccess(res, { myCode: user.friendCode, friends });
  } catch (error) {
    console.error("Friends list error:", error);
    sendError(res, "server_error", "Failed to fetch friends", 500);
  }
}
