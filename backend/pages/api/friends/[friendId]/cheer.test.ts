import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyCheer } from "@/services/notifications";
import handler from "./cheer";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    friendConnection: { findUnique: jest.fn() },
    friendCheer: { create: jest.fn() },
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock("@/services/notifications", () => ({
  notifyCheer: jest.fn(),
}));

function mockReqRes(friendId?: string) {
  const req = { method: "POST", query: { friendId } } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("friends/[friendId]/cheer handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1", name: "Jamie" });
    (prisma.friendConnection.findUnique as jest.Mock).mockResolvedValue({ id: "conn_1" });
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    (prisma.friendCheer.create as jest.Mock).mockResolvedValue({ id: "cheer_1" });
    (notifyCheer as jest.Mock).mockResolvedValue(true);
  });

  it("rejects cheering someone who isn't a connected friend", async () => {
    (prisma.friendConnection.findUnique as jest.Mock).mockResolvedValue(null);
    const { req, res } = mockReqRes("stranger_1");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.friendCheer.create).not.toHaveBeenCalled();
  });

  it("enforces the once-per-friend-per-day rate limit", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(false);
    const { req, res } = mockReqRes("friend_1");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(prisma.friendCheer.create).not.toHaveBeenCalled();
    expect(notifyCheer).not.toHaveBeenCalled();
  });

  it("creates a cheer record and sends a push notification", async () => {
    const { req, res } = mockReqRes("friend_1");
    await handler(req, res);

    expect(prisma.friendCheer.create).toHaveBeenCalledWith({
      data: { fromUserId: "user_1", toUserId: "friend_1" },
    });
    expect(notifyCheer).toHaveBeenCalledWith("friend_1", "Jamie");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
