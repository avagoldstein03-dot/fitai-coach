import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { checkRateLimit } from "@/lib/rate-limit";
import { AIProviderRegistry } from "@/services/ai-registry";
import handler from "./chat";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    chatMessage: { count: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    workoutSession: { findMany: jest.fn() },
    healthMetric: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    analyticsEvent: { create: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock("@/services/ai-registry", () => ({
  AIProviderRegistry: { getProviderForTask: jest.fn() },
}));

function mockReqRes(body: Record<string, unknown>) {
  const req = { method: "POST", body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

const baseUser = {
  id: "user_1",
  name: "Jamie",
  age: 30,
  sex: "female",
  height: 165,
  weight: 60,
  activityLevel: "moderately_active",
  fitnessExperience: "beginner",
  injuryHistory: null,
  dietPreferences: [],
  foodAllergies: [],
  goal: null,
  meals: [],
  workoutSessions: [],
  bodyAssessments: [],
};

describe("coach/chat handler", () => {
  const mockChat = jest.fn().mockResolvedValue("Great question!");

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    (getUserSubscription as jest.Mock).mockResolvedValue({
      isPremium: true,
      tier: "elite",
      limits: { dailyCoachMessages: Infinity },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
    (prisma.chatMessage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.chatMessage.count as jest.Mock).mockResolvedValue(0);
    (prisma.chatMessage.create as jest.Mock).mockResolvedValue({ id: "msg_1", content: "reply" });
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);
    (AIProviderRegistry.getProviderForTask as jest.Mock).mockReturnValue({ chat: mockChat });
  });

  it("passes conversationHistory, trendsSummary, coachingDirective, and healthSummary into the AI context", async () => {
    const priorMessages = [
      { role: "user", content: "I'm training for a 5k" },
      { role: "assistant", content: "Great goal!" },
    ];
    (prisma.chatMessage.findMany as jest.Mock).mockResolvedValue(priorMessages);

    const { req, res } = mockReqRes({ message: "what did I just tell you?" });
    await handler(req, res);

    const context = mockChat.mock.calls[0][1];
    expect(context.conversationHistory).toEqual(priorMessages);
    expect(typeof context.trendsSummary).toBe("string");
    expect(typeof context.coachingDirective).toBe("string");
    expect(typeof context.healthSummary).toBe("string");
    expect(context.coachingDirective).toMatch(/form|confidence/i); // beginner, per baseUser
  });

  it("surfaces a plateau in trendsSummary when workout sessions are stagnant", async () => {
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue(
      [0, 1, 2].map(() => ({
        exerciseName: "Bench Press",
        weight: 135,
        completedReps: "8",
        createdAt: new Date(),
      }))
    );

    const { req, res } = mockReqRes({ message: "how's my bench going?" });
    await handler(req, res);

    const context = mockChat.mock.calls[0][1];
    expect(context.trendsSummary).toContain("Bench Press");
  });

  it("surfaces synced health metrics in healthSummary", async () => {
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
      { date: new Date(), steps: 9000, activeEnergyKcal: null, sleepMinutes: 420, restingHeartRate: null },
    ]);

    const { req, res } = mockReqRes({ message: "how active have I been?" });
    await handler(req, res);

    const context = mockChat.mock.calls[0][1];
    expect(context.healthSummary).toContain("9000 steps/day");
  });

  it("still enforces the free-tier daily message limit", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({
      isPremium: false,
      tier: "free",
      limits: { dailyCoachMessages: 5 },
    });
    (prisma.chatMessage.count as jest.Mock).mockResolvedValue(5);

    const { req, res } = mockReqRes({ message: "hi" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("reads the daily limit from subscription.limits rather than a hardcoded value", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({
      isPremium: false,
      tier: "free",
      limits: { dailyCoachMessages: 3 },
    });
    (prisma.chatMessage.count as jest.Mock).mockResolvedValue(3);

    const { req, res } = mockReqRes({ message: "hi" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.message).toContain("3 messages per day");
  });

  it("never enforces a daily limit when the tier's limit is Infinity", async () => {
    (prisma.chatMessage.count as jest.Mock).mockResolvedValue(9999);

    const { req, res } = mockReqRes({ message: "hi" });
    await handler(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(mockChat).toHaveBeenCalled();
  });

  it("still detects an upgrade-worthy keyword for free-tier users", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({
      isPremium: false,
      tier: "free",
      limits: { dailyCoachMessages: 5 },
    });

    const { req, res } = mockReqRes({ message: "can you make me a workout plan?" });
    await handler(req, res);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.data.requiresUpgrade).toBe(true);
    expect(responseBody.data.upgradeTo).toBe("starter");
  });

  it("rejects a missing message without touching Prisma", async () => {
    const { req, res } = mockReqRes({ message: "   " });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
