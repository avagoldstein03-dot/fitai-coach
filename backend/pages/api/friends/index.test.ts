import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./index";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    friendConnection: { findMany: jest.fn() },
    workoutSession: { findMany: jest.fn() },
  },
}));

function mockReqRes() {
  const req = { method: "GET", query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("friends/index (GET) handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.friendConnection.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("generates and persists a friend code lazily when the user doesn't have one", async () => {
    // findUnique is used both to load the user AND (internally, by
    // generateUniqueFriendCode) to check whether a candidate code collides —
    // distinguish by the `where` clause rather than a single blanket mock.
    (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.clerkId) return Promise.resolve({ id: "user_1", friendCode: null });
      if (where.friendCode) return Promise.resolve(null); // no collision
      return Promise.resolve(null);
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1", friendCode: "ABC234" });

    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalled();
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.data.myCode).toBe("ABC234");
  });

  it("does not regenerate a code the user already has", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1", friendCode: "EXISTNG" });

    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(prisma.user.update).not.toHaveBeenCalled();
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.data.myCode).toBe("EXISTNG");
  });

  it("returns each friend's streak and last workout date, not the full dashboard payload", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1", friendCode: "ABC234" });
    (prisma.friendConnection.findMany as jest.Mock).mockResolvedValue([
      { friendId: "friend_1", friend: { id: "friend_1", name: "Sam" } },
    ]);
    const lastSession = new Date();
    (prisma.workoutSession.findMany as jest.Mock).mockResolvedValue([{ createdAt: lastSession }]);

    const { req, res } = mockReqRes();
    await handler(req, res);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.data.friends).toHaveLength(1);
    expect(responseBody.data.friends[0]).toEqual({
      id: "friend_1",
      name: "Sam",
      workoutStreak: 1,
      lastWorkoutDate: lastSession,
    });
    // Confirm it doesn't leak unrelated fields like weight/subscription
    expect(responseBody.data.friends[0]).not.toHaveProperty("weight");
    expect(responseBody.data.friends[0]).not.toHaveProperty("subscription");
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
