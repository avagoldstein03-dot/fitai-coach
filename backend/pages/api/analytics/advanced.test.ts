import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import handler from "./advanced";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    weightLog: { findMany: jest.fn() },
    healthMetric: { findMany: jest.fn() },
    meal: { findMany: jest.fn() },
    workoutSession: { findMany: jest.fn() },
    bodyAssessment: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

function mockReqRes(method: string, query: Record<string, unknown> = {}) {
  const req = { method, query } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("analytics/advanced handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { advancedAnalytics: true } });
    (prisma.weightLog.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.meal.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bodyAssessment.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = mockReqRes("POST");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects non-elite users without touching any data source", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { advancedAnalytics: false } });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.weightLog.findMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid range value", async () => {
    const { req, res } = mockReqRes("GET", { range: "7" });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("defaults to a 30-day range when omitted", async () => {
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.data.range).toBe(30);
  });

  it("returns 200 with every section populated for a fully-seeded elite user", async () => {
    (prisma.weightLog.findMany as jest.Mock).mockResolvedValue([
      { weight: 185, loggedAt: new Date("2026-07-01") },
      { weight: 180, loggedAt: new Date("2026-07-20") },
    ]);
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
      { date: new Date("2026-07-20"), steps: 8000, activeEnergyKcal: 400, sleepMinutes: 420, restingHeartRate: 60 },
    ]);
    (prisma.meal.findMany as jest.Mock).mockResolvedValue([
      {
        createdAt: new Date("2026-07-20"),
        totalCarbs: 50,
        totalFat: 20,
        totalFiber: 5,
        foods: [{ sugar: 10, sodium: 200, cholesterol: 30 }],
      },
    ]);
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([
      { exerciseName: "Bench Press", weight: 135, completedReps: "8", createdAt: new Date("2026-07-18") },
      { exerciseName: "Bench Press", weight: 135, completedReps: "8", createdAt: new Date("2026-07-19") },
      { exerciseName: "Bench Press", weight: 135, completedReps: "8", createdAt: new Date("2026-07-20") },
    ]);
    (prisma.bodyAssessment.findMany as jest.Mock).mockResolvedValue([
      { bodyComposition: { build: "lean" } },
      { bodyComposition: { build: "athletic" } },
    ]);

    const { req, res } = mockReqRes("GET", { range: "90" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data.range).toBe(90);
    expect(data.weight).not.toBeNull();
    expect(data.health).not.toBeNull();
    expect(data.macros).not.toBeNull();
    expect(data.workouts.volume.length).toBeGreaterThan(0);
    expect(data.workouts.plateaus).toHaveLength(1);
    expect(data.bodyComposition.diffs).toHaveLength(1);
  });

  it("returns 200 with independently null/empty sections when data sources are sparse, without 500ing", async () => {
    (prisma.bodyAssessment.findMany as jest.Mock).mockResolvedValue([{ bodyComposition: { build: "lean" } }]);

    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data.weight).toBeNull();
    expect(data.health).toBeNull();
    expect(data.macros).toBeNull();
    expect(data.workouts.volume).toEqual([]);
    expect(data.workouts.plateaus).toEqual([]);
    expect(data.bodyComposition.diffs).toEqual([]);
  });
});
