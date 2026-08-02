import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
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
  });

  it("rejects a missing code without touching Prisma", async () => {
    const { req, res } = mockReqRes({});
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown code", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user_1" }) // self lookup
      .mockResolvedValueOnce(null); // code lookup

    const { req, res } = mockReqRes({ code: "NOPE12" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects connecting to yourself", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user_1" })
      .mockResolvedValueOnce({ id: "user_1", name: "Me" });

    const { req, res } = mockReqRes({ code: "ABC234" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates both directional connections on a valid new connect", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user_1" })
      .mockResolvedValueOnce({ id: "friend_1", name: "Sam" });

    const { req, res } = mockReqRes({ code: "abc234" }); // lowercase, should normalize
    await handler(req, res);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("is idempotent when a connection already exists", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user_1" })
      .mockResolvedValueOnce({ id: "friend_1", name: "Sam" });
    (prisma.friendConnection.findUnique as jest.Mock).mockResolvedValue({ id: "conn_1" });

    const { req, res } = mockReqRes({ code: "ABC234" });
    await handler(req, res);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
