import prisma from "@/lib/prisma";
import { computeReadinessScore, type ReadinessResult } from "@/lib/trends";

/**
 * Loads the inputs for today's readiness score and computes it.
 *
 * Extracted because two places need it now: the readiness endpoint that feeds
 * the dashboard, and the workout read, which uses it to adapt today's session.
 * Duplicating the query would let the two drift — the number on the dashboard
 * and the number the training was adjusted for have to be the same number.
 */

export const READINESS_LOOKBACK_DAYS = 14;

/** Takes the Clerk id, which is what every handler has to hand. */
export async function loadReadinessForUser(clerkId: string): Promise<ReadinessResult | null> {
  const since = new Date(Date.now() - READINESS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [healthRows, workoutSessions] = await Promise.all([
    prisma.healthMetric.findMany({
      where: { user: { clerkId }, date: { gte: since } },
      select: { date: true, sleepMinutes: true, restingHeartRate: true },
    }),
    prisma.workoutSession.findMany({
      where: { user: { clerkId }, createdAt: { gte: since } },
      select: { createdAt: true, weight: true, completedReps: true },
    }),
  ]);

  return computeReadinessScore({
    healthRows: healthRows.map((r) => ({
      date: r.date.toISOString().split("T")[0],
      sleepMinutes: r.sleepMinutes,
      restingHeartRate: r.restingHeartRate,
    })),
    workoutSessions,
  });
}
