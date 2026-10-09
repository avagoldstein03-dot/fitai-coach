import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { loadReadinessForUser } from "@/lib/readiness";
import { adaptSessionToReadiness } from "@/lib/readiness-adaptation";
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
            // Rows have no inherent order in Postgres. Without these the days of
            // a week and the exercises within a session came back in whatever
            // order the planner chose, so the training order was lost on read.
            days: {
              orderBy: { dayOfWeek: "asc" },
              include: { exercises: { orderBy: { position: "asc" } } },
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

    // Adapt today's session to how recovered they actually are. The readiness
    // score already existed and nothing acted on it — the app would say 44 and
    // then serve the session it planned three weeks ago. Only today's day is
    // touched, and only its set counts; see lib/readiness-adaptation.
    const readiness = await loadReadinessForUser(userId);
    let todayAdaptation = null;
    if (activeProgram) {
      const todayIdx = (new Date().getDay() + 6) % 7; // Monday = 0
      for (const week of activeProgram.weeks) {
        const day = week.days.find((d) => d.dayOfWeek === todayIdx);
        if (!day) continue;
        const { exercises, adaptation } = adaptSessionToReadiness(day.exercises, readiness);
        day.exercises = exercises;
        todayAdaptation = adaptation;
        break; // week 1 holds the canonical session; later weeks mirror it
      }
    }

    const completedThisWeek = sessions.filter((s) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(s.createdAt) >= weekAgo;
    }).length;

    sendSuccess(res, {
      activeProgram,
      todayAdaptation,
      readiness,
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
