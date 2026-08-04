import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import handler from "./insights";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    weeklyInsight: { findFirst: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

function mockReqRes(method: string) {
  const req = { method, query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("analytics/insights handler", () => {
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

  it("403s users below the progressReviews tier", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { progressReviews: false } });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.weeklyInsight.findFirst).not.toHaveBeenCalled();
  });

  it("returns null insights when no row exists yet", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { progressReviews: true } });
    (prisma.weeklyInsight.findFirst as jest.Mock).mockResolvedValue(null);
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toEqual({ weekOf: null, insights: null });
  });

  it("returns the latest insight row for a Pro+ user", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { progressReviews: true } });
    const weekOf = new Date("2026-08-02T00:00:00.000Z");
    (prisma.weeklyInsight.findFirst as jest.Mock).mockResolvedValue({
      weekOf,
      insights: ["Your sleep dropped alongside your training volume."],
    });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(prisma.weeklyInsight.findFirst).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      orderBy: { weekOf: "desc" },
      select: { weekOf: true, insights: true },
    });
    const body = res.json.mock.calls[0][0];
    expect(body.data).toEqual({ weekOf, insights: ["Your sleep dropped alongside your training volume."] });
  });
});
