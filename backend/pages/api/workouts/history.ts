import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { calculateStreak } from "@/lib/trends";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const programs = await prisma.workoutProgram.findMany({
      where: { user: { clerkId: userId } },
      include: {
        weeks: {
          include: {
            days: {
              include: { exercises: true },
            },
          },
          orderBy: { weekNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeProgram = programs.find((p) => p.isActive) || null;

    // Recent workout sessions
    const sessions = await prisma.workoutSession.findMany({
      where: { user: { clerkId: userId } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const completedThisWeek = sessions.filter((s) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(s.createdAt) >= weekAgo;
    }).length;

    sendSuccess(res, {
      activeProgram,
      programs,
      recentSessions: sessions,
      stats: {
        completedThisWeek,
        totalSessions: sessions.length,
        currentStreak: calculateStreak(sessions),
      },
    });
  } catch (error) {
    console.error("Workout history error:", error);
    sendError(res, "server_error", "Failed to fetch workout history", 500);
  }
}
