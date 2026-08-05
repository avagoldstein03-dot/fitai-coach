import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { BADGE_CATALOG } from "@/lib/badges";
import handler from "./badges";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    userBadge: { findMany: jest.fn() },
  },
}));

function mockReqRes(method: string) {
  const req = { method, query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("analytics/badges handler", () => {
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

  it("returns the full catalog with correct earned/locked state, no tier gate", async () => {
    const earnedAt = new Date("2026-08-01T00:00:00.000Z");
    (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([{ badgeKey: "first_workout", earnedAt }]);

    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data.badges).toHaveLength(BADGE_CATALOG.length);
    const firstWorkout = body.data.badges.find((b: any) => b.key === "first_workout");
    expect(firstWorkout).toMatchObject({ earned: true, earnedAt });
    const streak30 = body.data.badges.find((b: any) => b.key === "streak_30");
    expect(streak30).toMatchObject({ earned: false, earnedAt: null });
  });
});
