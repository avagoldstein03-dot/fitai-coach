import prisma from "@/lib/prisma";
import { notifyAchievementUnlocked } from "./notifications";
import { checkAndAwardBadges } from "./badges";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    workoutSession: { count: jest.fn(), findMany: jest.fn() },
    meal: { count: jest.fn(), findMany: jest.fn() },
    bodyAssessment: { count: jest.fn() },
    friendConnection: { count: jest.fn() },
    userBadge: { findMany: jest.fn(), upsert: jest.fn() },
  },
}));

jest.mock("./notifications", () => ({
  notifyAchievementUnlocked: jest.fn(),
}));

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function mockCounts(overrides: Partial<{ workoutCount: number; mealCount: number; bodyScanCount: number; friendCount: number; workoutSessions: Array<{ createdAt: Date }>; meals: Array<{ createdAt: Date }>; alreadyEarned: string[] }> = {}) {
  (prisma.workoutSession.count as jest.Mock).mockResolvedValue(overrides.workoutCount ?? 0);
  (prisma.meal.count as jest.Mock).mockResolvedValue(overrides.mealCount ?? 0);
  (prisma.bodyAssessment.count as jest.Mock).mockResolvedValue(overrides.bodyScanCount ?? 0);
  (prisma.friendConnection.count as jest.Mock).mockResolvedValue(overrides.friendCount ?? 0);
  (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue(overrides.workoutSessions ?? []);
  (prisma.meal.findMany as jest.Mock).mockResolvedValue(overrides.meals ?? []);
  (prisma.userBadge.findMany as jest.Mock).mockResolvedValue((overrides.alreadyEarned ?? []).map((badgeKey) => ({ badgeKey })));
}

describe("checkAndAwardBadges", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (notifyAchievementUnlocked as jest.Mock).mockResolvedValue(true);
  });

  it("awards a badge that just crossed its threshold and notifies once", async () => {
    mockCounts({ workoutCount: 1 });

    const result = await checkAndAwardBadges("user_1");

    expect(result.map((b) => b.key)).toEqual(["first_workout"]);
    expect(prisma.userBadge.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.userBadge.upsert).toHaveBeenCalledWith({
      where: { userId_badgeKey: { userId: "user_1", badgeKey: "first_workout" } },
      update: {},
      create: { userId: "user_1", badgeKey: "first_workout" },
    });
    expect(notifyAchievementUnlocked).toHaveBeenCalledTimes(1);
  });

  it("does not re-award or re-notify a badge already earned", async () => {
    mockCounts({ workoutCount: 1, alreadyEarned: ["first_workout"] });

    const result = await checkAndAwardBadges("user_1");

    expect(result).toEqual([]);
    expect(prisma.userBadge.upsert).not.toHaveBeenCalled();
    expect(notifyAchievementUnlocked).not.toHaveBeenCalled();
  });

  it("does not award badges below their threshold", async () => {
    mockCounts({ workoutCount: 0, mealCount: 0, bodyScanCount: 0, friendCount: 0 });

    const result = await checkAndAwardBadges("user_1");

    expect(result).toEqual([]);
    expect(prisma.userBadge.upsert).not.toHaveBeenCalled();
  });

  it("awards streak badges based on real consecutive-day data", async () => {
    const workoutSessions = [0, 1, 2].map((n) => ({ createdAt: daysAgo(n) }));
    mockCounts({ workoutCount: 3, workoutSessions });

    const result = await checkAndAwardBadges("user_1");

    expect(result.map((b) => b.key)).toEqual(expect.arrayContaining(["streak_3"]));
    expect(result.map((b) => b.key)).not.toEqual(expect.arrayContaining(["streak_7"]));
  });

  it("awards every badge newly qualified for in one call, not just one", async () => {
    // 10 consecutive days of workouts crosses first_workout, streak_3,
    // streak_7, and ten_workouts all at once — none of these should be
    // missed just because multiple thresholds cross in the same check.
    const workoutSessions = Array.from({ length: 10 }, (_, i) => ({ createdAt: daysAgo(i) }));
    mockCounts({ workoutCount: 10, workoutSessions });

    const result = await checkAndAwardBadges("user_1");

    expect(result.map((b) => b.key).sort()).toEqual(["first_workout", "streak_3", "streak_7", "ten_workouts"].sort());
  });
});
