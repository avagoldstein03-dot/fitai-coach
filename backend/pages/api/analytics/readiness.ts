import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { computeReadinessScore } from "@/lib/trends";

const LOOKBACK_DAYS = 14;

// No tier gate — meant to be a headline, immediately-visible feature. Pure
// arithmetic (no AI call), so it's computed live on every request rather
// than batched/cached like the AI-driven weekly insights.
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

    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const [healthRows, workoutSessions] = await Promise.all([
      prisma.healthMetric.findMany({
        where: { userId: user.id, date: { gte: since } },
        select: { date: true, sleepMinutes: true, restingHeartRate: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { createdAt: true, weight: true, completedReps: true },
      }),
    ]);

    const readiness = computeReadinessScore({
      healthRows: healthRows.map((r) => ({
        date: r.date.toISOString().split("T")[0],
        sleepMinutes: r.sleepMinutes,
        restingHeartRate: r.restingHeartRate,
      })),
      workoutSessions,
    });

    sendSuccess(res, { readiness });
  } catch (error) {
    console.error("Readiness error:", error);
    sendError(res, "server_error", "Failed to compute readiness score", 500);
  }
}
