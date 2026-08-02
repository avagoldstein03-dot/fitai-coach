import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import handler from "./sync";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    healthMetric: { upsert: jest.fn(), findFirst: jest.fn() },
    weightLog: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

function mockReqRes(method: "GET" | "POST", body: Record<string, unknown> = {}) {
  const req = { method, body, query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("health/sync handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (prisma.healthMetric.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.weightLog.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.weightLog.findUnique as jest.Mock).mockResolvedValue(null);
  });

  describe("POST", () => {
    it("rejects an invalid payload without touching Prisma", async () => {
      const { req, res } = mockReqRes("POST", { metrics: [{ date: "not-a-date" }] });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("upserts only the fields present in each metric", async () => {
      const { req, res } = mockReqRes("POST", {
        metrics: [{ date: "2026-08-01", steps: 8000 }],
      });
      await handler(req, res);

      expect(prisma.$transaction).toHaveBeenCalled();
      const upsertCall = (prisma.healthMetric.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.update).toEqual({ steps: 8000 });
      expect(upsertCall.create).toMatchObject({ steps: 8000, userId: "user_1" });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("dedupes a weight sample already synced by externalId", async () => {
      (prisma.weightLog.findUnique as jest.Mock).mockResolvedValue({ id: "log_1" });
      const { req, res } = mockReqRes("POST", {
        metrics: [],
        latestWeight: { kg: 70, sampleUuid: "sample-1", sampleDate: "2026-08-01T00:00:00.000Z" },
      });
      await handler(req, res);

      expect(prisma.weightLog.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("does not update User.weight when the synced sample is older than the latest log", async () => {
      (prisma.weightLog.findFirst as jest.Mock).mockResolvedValue({
        loggedAt: new Date("2026-08-05T00:00:00.000Z"),
      });
      const { req, res } = mockReqRes("POST", {
        metrics: [],
        latestWeight: { kg: 70, sampleUuid: "sample-1", sampleDate: "2026-08-01T00:00:00.000Z" },
      });
      await handler(req, res);

      expect(prisma.weightLog.create).toHaveBeenCalled(); // still logged for history
      expect(prisma.user.update).not.toHaveBeenCalled(); // but doesn't overwrite the fresher value
    });

    it("updates User.weight when the synced sample is newer than the latest log", async () => {
      (prisma.weightLog.findFirst as jest.Mock).mockResolvedValue({
        loggedAt: new Date("2026-07-01T00:00:00.000Z"),
      });
      const { req, res } = mockReqRes("POST", {
        metrics: [],
        latestWeight: { kg: 70, sampleUuid: "sample-1", sampleDate: "2026-08-01T00:00:00.000Z" },
      });
      await handler(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { weight: 70 } });
    });

    it("enforces the rate limit", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue(false);
      const { req, res } = mockReqRes("POST", { metrics: [] });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("GET", () => {
    it("returns null lastSyncedAt when nothing has synced yet", async () => {
      const { req, res } = mockReqRes("GET");
      await handler(req, res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.lastSyncedAt).toBeNull();
    });

    it("returns the most recent sync timestamp across metrics and weight", async () => {
      (prisma.healthMetric.findFirst as jest.Mock).mockResolvedValue({
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      });
      (prisma.weightLog.findFirst as jest.Mock).mockResolvedValue({
        loggedAt: new Date("2026-08-05T00:00:00.000Z"),
      });
      const { req, res } = mockReqRes("GET");
      await handler(req, res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.lastSyncedAt).toBe("2026-08-05T00:00:00.000Z");
    });
  });
});
