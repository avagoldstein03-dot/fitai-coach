import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./readiness";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    healthMetric: { findMany: jest.fn() },
    workoutSession: { findMany: jest.fn() },
  },
}));

function mockReqRes(method: string) {
  const req = { method, query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("analytics/readiness handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
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

  it("is accessible on the free tier (no tier gate) and returns null gracefully with no data", async () => {
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toEqual({ readiness: null });
  });

  it("returns a computed readiness score for a user with enough data", async () => {
    const days = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
      { date: days(4), sleepMinutes: 480, restingHeartRate: 55 },
      { date: days(3), sleepMinutes: 480, restingHeartRate: 55 },
      { date: days(2), sleepMinutes: 480, restingHeartRate: 55 },
      { date: days(1), sleepMinutes: 480, restingHeartRate: 55 },
      { date: days(0), sleepMinutes: 480, restingHeartRate: 55 },
    ]);
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data.readiness).not.toBeNull();
    expect(typeof body.data.readiness.score).toBe("number");
  });
});
