import prisma from "@/lib/prisma";
import { AIProviderRegistry } from "./ai-registry";
import { aggregateHealthMetrics, computeWorkoutVolumeTrend, detectCrossDomainSignals } from "@/lib/trends";
import { resolveTier, TIER_LIMITS } from "@/lib/subscription-middleware";

function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

// Computes and persists this week's cross-domain insights for one user, if
// there's anything notable — an empty signal set is the normal case (new
// users, or a quiet week) and must not write a forced/empty row or call the
// AI provider for nothing.
export async function generateWeeklyInsightsForUser(userId: string): Promise<void> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [weightLogs, healthRows, workoutSessions] = await Promise.all([
    prisma.weightLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      select: { weight: true, loggedAt: true },
    }),
    prisma.healthMetric.findMany({
      where: { userId, date: { gte: since } },
      select: { date: true, steps: true, activeEnergyKcal: true, sleepMinutes: true, restingHeartRate: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { exerciseName: true, weight: true, completedReps: true, createdAt: true },
    }),
  ]);

  const healthSeries = aggregateHealthMetrics(healthRows);
  const volumeSeries = computeWorkoutVolumeTrend(workoutSessions);

  const signals = detectCrossDomainSignals({
    healthSeries: healthSeries?.series ?? null,
    volumeSeries,
    weightLogs,
  });
  if (!signals.length) return;

  const provider = AIProviderRegistry.getProviderForTask("cross_domain_insights");
  const insights = await provider.generateCrossDomainInsights(signals);
  if (!insights.length) return;

  const weekOf = startOfWeek();
  await prisma.weeklyInsight.upsert({
    where: { userId_weekOf: { userId, weekOf } },
    update: { insights },
    create: { userId, weekOf, insights },
  });
}

// Sunday-cron entry point — mirrors the Pro+ gate broadcastWeeklyReviewReady
// already uses (TIER_LIMITS[tier].progressReviews), since this reuses the
// same rich multi-domain data that feature is gated on.
export async function generateWeeklyInsightsForAllEligibleUsers(): Promise<{ attempted: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { onboardingCompleted: true },
    select: {
      id: true,
      subscription: {
        select: { plan: true, status: true, currentPeriodEnd: true, stripePriceId: true, tier: true },
      },
    },
  });

  const eligible = users.filter((u) => {
    const { tier } = resolveTier(u.subscription);
    return TIER_LIMITS[tier].progressReviews;
  });

  const results = await Promise.allSettled(eligible.map((u) => generateWeeklyInsightsForUser(u.id)));
  const failed = results.filter((r) => r.status === "rejected").length;
  return { attempted: eligible.length, failed };
}
