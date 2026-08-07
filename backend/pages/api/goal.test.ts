import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./goal";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    goal: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

function mockReqRes(method: string, body: Record<string, unknown> = {}) {
  const req = { method, body, query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("goal handler", () => {
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

  it("GET returns the current goal", async () => {
    (prisma.goal.findUnique as jest.Mock).mockResolvedValue({ id: "goal_1", primaryGoal: "fat_loss" });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data.goal.primaryGoal).toBe("fat_loss");
  });

  it("PATCH upserts the primary goal without touching onboardingStep", async () => {
    (prisma.goal.upsert as jest.Mock).mockResolvedValue({ id: "goal_1", primaryGoal: "muscle_gain" });
    const { req, res } = mockReqRes("PATCH", { primaryGoal: "muscle_gain" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.goal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { primaryGoal: "muscle_gain" },
        create: { userId: "user_1", primaryGoal: "muscle_gain" },
      })
    );
  });

  it("rejects an invalid primaryGoal value", async () => {
    const { req, res } = mockReqRes("PATCH", { primaryGoal: "get_ripped_fast" });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.goal.upsert).not.toHaveBeenCalled();
  });
});
