import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { BADGE_CATALOG } from "@/lib/badges";

// No tier gate — badges are a retention feature, not a paywall lever.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const earned = await prisma.userBadge.findMany({
      where: { userId: user.id },
      select: { badgeKey: true, earnedAt: true },
    });
    const earnedByKey = new Map(earned.map((b) => [b.badgeKey, b.earnedAt]));

    const badges = BADGE_CATALOG.map((b) => ({
      ...b,
      earned: earnedByKey.has(b.key),
      earnedAt: earnedByKey.get(b.key) ?? null,
    }));

    sendSuccess(res, { badges });
  } catch (error) {
    console.error("Badges error:", error);
    sendError(res, "server_error", "Failed to fetch badges", 500);
  }
}
