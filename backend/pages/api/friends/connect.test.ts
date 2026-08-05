import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { grantCompDays } from "@/lib/subscription-grants";
import { checkAndAwardBadges } from "@/services/badges";
import { notifyReferralReward } from "@/services/notifications";
import handler from "./connect";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    friendConnection: { findUnique: jest.fn(), create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  },
}));

jest.mock("@/lib/subscription-grants", () => ({
  grantCompDays: jest.fn(),
}));

jest.mock("@/services/badges", () => ({
  checkAndAwardBadges: jest.fn(),
}));

jest.mock("@/services/notifications", () => ({
  notifyReferralReward: jest.fn(),
}));

function mockReqRes(body: Record<string, unknown>) {
  const req = { method: "POST", body, query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("friends/connect handler", () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) — clearAllMocks leaves queued
    // mockResolvedValueOnce values from a prior test in place, which leaks
    // across tests here since several tests queue exactly two calls.
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.friendConnection.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.$transaction as jest.Mock).mockImplementation((ops) => Promise.all(ops));
    (grantCompDays as jest.Mock).mockResolvedValue(undefined);
    (checkAndAwardBadges as jest.Mock).mockResolvedValue([]);
    (notifyReferralReward as jest.Mock).mockResolvedValue(true);
  });

  it("rejects a missing code without touching Prisma", async () => {
    const { req, res } = mockReqRes({});
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown code", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user_1", name: "Me" }) // self lookup
      .mockResolvedValueOnce(null); // code lookup

    const { req, res } = mockReqRes({ code: "NOPE12" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects connecting to yourself", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user_1", name: "Me" })
      .mockResolvedValueOnce({ id: "user_1", name: "Me" });

    const { req, res } = mockReqRes({ code: "ABC234" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates both directional connections and grants the referral reward on a valid new connect", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user_1", name: "Me" })
      .mockResolvedValueOnce({ id: "friend_1", name: "Sam" });

    const { req, res } = mockReqRes({ code: "abc234" }); // lowercase, should normalize
    await handler(req, res);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);

    expect(grantCompDays).toHaveBeenCalledWith("user_1", "pro", 7);
    expect(grantCompDays).toHaveBeenCalledWith("friend_1", "pro", 7);
    expect(checkAndAwardBadges).toHaveBeenCalledWith("user_1");
    expect(checkAndAwardBadges).toHaveBeenCalledWith("friend_1");
    expect(notifyReferralReward).toHaveBeenCalledWith("user_1", "Sam");
    expect(notifyReferralReward).toHaveBeenCalledWith("friend_1", "Me");
  });

  it("is idempotent when a connection already exists, and grants no reward", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user_1", name: "Me" })
      .mockResolvedValueOnce({ id: "friend_1", name: "Sam" });
    (prisma.friendConnection.findUnique as jest.Mock).mockResolvedValue({ id: "conn_1" });

    const { req, res } = mockReqRes({ code: "ABC234" });
    await handler(req, res);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(grantCompDays).not.toHaveBeenCalled();
    expect(checkAndAwardBadges).not.toHaveBeenCalled();
    expect(notifyReferralReward).not.toHaveBeenCalled();
  });
});
