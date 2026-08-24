import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import handler from "./status";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

function mockReqRes(method: string) {
  const req = { method } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("subscriptions/status handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "test@example.com",
      subscription: null,
    });
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns the normalized tier alongside the raw subscription", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ tier: "elite", isPremium: true });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data.tier).toBe("elite");
    expect(data.subscription.plan).toBe("free");
  });

  it("defaults to a free tier subscription shape when the user has none", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ tier: "free", isPremium: false });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    const { data } = res.json.mock.calls[0][0];
    expect(data.tier).toBe("free");
    expect(data.subscription.status).toBe("active");
  });
});
