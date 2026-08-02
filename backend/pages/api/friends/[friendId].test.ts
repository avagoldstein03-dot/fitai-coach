import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./[friendId]";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    friendConnection: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  },
}));

function mockReqRes(friendId?: string) {
  const req = { method: "DELETE", query: { friendId } } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("friends/[friendId] (DELETE) handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (prisma.friendConnection.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.$transaction as jest.Mock).mockImplementation((ops) => Promise.all(ops));
  });

  it("rejects a missing friendId", async () => {
    const { req, res } = mockReqRes(undefined);
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("removes both directional connections", async () => {
    const { req, res } = mockReqRes("friend_1");
    await handler(req, res);

    expect(prisma.friendConnection.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", friendId: "friend_1" },
    });
    expect(prisma.friendConnection.deleteMany).toHaveBeenCalledWith({
      where: { userId: "friend_1", friendId: "user_1" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
