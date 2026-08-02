import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import handler from "./index";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    userSupplement: { findMany: jest.fn(), create: jest.fn() },
    supplement: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

const VALID_BODY = {
  name: "Creatine Monohydrate",
  dosage: "5g",
  frequency: "daily",
};

function mockReqRes(method: string, body: Record<string, unknown> = VALID_BODY) {
  const req = { method, body, query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("supplements/stack (index) handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { supplements: true } });
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = mockReqRes("PUT");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  describe("GET", () => {
    it("lists the user's stack, flattened from the supplement relation", async () => {
      (prisma.userSupplement.findMany as jest.Mock).mockResolvedValue([
        {
          id: "us_1",
          dosage: "5g",
          frequency: "daily",
          reason: "Strength",
          createdAt: new Date("2026-01-01"),
          supplement: { name: "Creatine Monohydrate", category: "creatine" },
        },
      ]);

      const { req, res } = mockReqRes("GET");
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.stack).toEqual([
        {
          id: "us_1",
          name: "Creatine Monohydrate",
          category: "creatine",
          dosage: "5g",
          frequency: "daily",
          reason: "Strength",
          createdAt: new Date("2026-01-01"),
        },
      ]);
    });
  });

  describe("POST", () => {
    it("rejects non-subscribed users without touching the database", async () => {
      (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { supplements: false } });
      const { req, res } = mockReqRes("POST");
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.userSupplement.create).not.toHaveBeenCalled();
    });

    it("rejects invalid input", async () => {
      const { req, res } = mockReqRes("POST", { name: "", dosage: "", frequency: "" });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.userSupplement.create).not.toHaveBeenCalled();
    });

    it("reuses catalog metadata for a known supplement name", async () => {
      (prisma.supplement.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.supplement.create as jest.Mock).mockResolvedValue({ id: "supp_1", name: "Creatine Monohydrate", category: "creatine" });
      (prisma.userSupplement.create as jest.Mock).mockResolvedValue({
        id: "us_1", dosage: "5g", frequency: "daily", reason: "", createdAt: new Date(),
      });

      const { req, res } = mockReqRes("POST", VALID_BODY);
      await handler(req, res);

      expect(prisma.supplement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "Creatine Monohydrate", category: "creatine" }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("defaults to a custom category for an unknown supplement name", async () => {
      (prisma.supplement.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.supplement.create as jest.Mock).mockResolvedValue({ id: "supp_2", name: "My Weird Herb", category: "custom" });
      (prisma.userSupplement.create as jest.Mock).mockResolvedValue({
        id: "us_2", dosage: "1 pill", frequency: "daily", reason: "", createdAt: new Date(),
      });

      const { req, res } = mockReqRes("POST", { name: "My Weird Herb", dosage: "1 pill", frequency: "daily" });
      await handler(req, res);

      expect(prisma.supplement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "My Weird Herb", category: "custom", benefits: [] }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("reuses an existing catalog entry instead of creating a duplicate", async () => {
      (prisma.supplement.findFirst as jest.Mock).mockResolvedValue({ id: "supp_1", name: "Creatine Monohydrate", category: "creatine" });
      (prisma.userSupplement.create as jest.Mock).mockResolvedValue({
        id: "us_3", dosage: "5g", frequency: "daily", reason: "", createdAt: new Date(),
      });

      const { req, res } = mockReqRes("POST", VALID_BODY);
      await handler(req, res);

      expect(prisma.supplement.create).not.toHaveBeenCalled();
      expect(prisma.userSupplement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ supplementId: "supp_1", userId: "user_1" }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
