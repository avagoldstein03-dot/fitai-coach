import prisma from "@/lib/prisma";
import { AIProviderRegistry } from "./ai-registry";
import { generateWeeklyInsightsForUser, generateWeeklyInsightsForAllEligibleUsers } from "./insights";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findMany: jest.fn() },
    weightLog: { findMany: jest.fn() },
    healthMetric: { findMany: jest.fn() },
    workoutSession: { findMany: jest.fn() },
    weeklyInsight: { upsert: jest.fn() },
  },
}));

jest.mock("./ai-registry", () => ({
  AIProviderRegistry: { getProviderForTask: jest.fn() },
}));

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

describe("generateWeeklyInsightsForUser", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.weightLog.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("skips (no DB write, no AI call) when there are no notable signals", async () => {
    const generateCrossDomainInsights = jest.fn();
    (AIProviderRegistry.getProviderForTask as jest.Mock).mockReturnValue({ generateCrossDomainInsights });
    // Flat sleep/volume across both weeks — nothing moves significantly.
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue(
      [0, 7].map((n) => ({ date: daysAgo(n), steps: 8000, activeEnergyKcal: 300, sleepMinutes: 480, restingHeartRate: 60 }))
    );
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([
      { exerciseName: "Squat", weight: 100, completedReps: "5", createdAt: daysAgo(0) },
      { exerciseName: "Squat", weight: 100, completedReps: "5", createdAt: daysAgo(7) },
    ]);

    await generateWeeklyInsightsForUser("user_1");

    expect(generateCrossDomainInsights).not.toHaveBeenCalled();
    expect(prisma.weeklyInsight.upsert).not.toHaveBeenCalled();
  });

  it("calls the AI provider and upserts a row when signals exist", async () => {
    const generateCrossDomainInsights = jest.fn().mockResolvedValue(["Your sleep dropped alongside your training volume."]);
    (AIProviderRegistry.getProviderForTask as jest.Mock).mockReturnValue({ generateCrossDomainInsights });
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
      { date: daysAgo(0), steps: null, activeEnergyKcal: null, sleepMinutes: 300, restingHeartRate: null },
      { date: daysAgo(7), steps: null, activeEnergyKcal: null, sleepMinutes: 480, restingHeartRate: null },
    ]);
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([
      { exerciseName: "Squat", weight: 50, completedReps: "10", createdAt: daysAgo(0) },
      { exerciseName: "Squat", weight: 100, completedReps: "10", createdAt: daysAgo(7) },
    ]);

    await generateWeeklyInsightsForUser("user_1");

    expect(generateCrossDomainInsights).toHaveBeenCalledTimes(1);
    expect(prisma.weeklyInsight.upsert).toHaveBeenCalledTimes(1);
    const call = (prisma.weeklyInsight.upsert as jest.Mock).mock.calls[0][0];
    expect(call.create.userId).toBe("user_1");
    expect(call.create.insights).toEqual(["Your sleep dropped alongside your training volume."]);
  });

  it("skips writing when signals exist but the AI returns nothing usable", async () => {
    const generateCrossDomainInsights = jest.fn().mockResolvedValue([]);
    (AIProviderRegistry.getProviderForTask as jest.Mock).mockReturnValue({ generateCrossDomainInsights });
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
      { date: daysAgo(0), steps: null, activeEnergyKcal: null, sleepMinutes: 300, restingHeartRate: null },
      { date: daysAgo(7), steps: null, activeEnergyKcal: null, sleepMinutes: 480, restingHeartRate: null },
    ]);
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([
      { exerciseName: "Squat", weight: 50, completedReps: "10", createdAt: daysAgo(0) },
      { exerciseName: "Squat", weight: 100, completedReps: "10", createdAt: daysAgo(7) },
    ]);

    await generateWeeklyInsightsForUser("user_1");

    expect(prisma.weeklyInsight.upsert).not.toHaveBeenCalled();
  });
});

describe("generateWeeklyInsightsForAllEligibleUsers", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.weightLog.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("only attempts users on a tier with progressReviews (pro/elite)", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "free_user", subscription: null },
      { id: "starter_user", subscription: { plan: "premium", status: "active", currentPeriodEnd: new Date(Date.now() + 1e9), stripePriceId: null, tier: "starter" } },
      { id: "pro_user", subscription: { plan: "premium", status: "active", currentPeriodEnd: new Date(Date.now() + 1e9), stripePriceId: null, tier: "pro" } },
      { id: "elite_user", subscription: { plan: "premium", status: "active", currentPeriodEnd: new Date(Date.now() + 1e9), stripePriceId: null, tier: "elite" } },
    ]);

    const result = await generateWeeklyInsightsForAllEligibleUsers();

    expect(result.attempted).toBe(2);
  });
});
