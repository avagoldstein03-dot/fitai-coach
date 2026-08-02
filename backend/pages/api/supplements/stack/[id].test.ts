import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./[id]";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    userSupplement: { updateMany: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn() },
  },
}));

const VALID_PATCH_BODY = { dosage: "10g", frequency: "twice daily", reason: "Updated dosage" };

function mockReqRes(method: string, query: Record<string, unknown> = { id: "us_1" }, body: Record<string, unknown> = {}) {
  const req = { method, query, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("supplements/stack/[id] handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = mockReqRes("PUT");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes("DELETE");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects a missing id", async () => {
    const { req, res } = mockReqRes("DELETE", {});
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  describe("DELETE", () => {
    it("returns 404 when not found or not owned", async () => {
      (prisma.userSupplement.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      const { req, res } = mockReqRes("DELETE");
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("deletes an owned supplement", async () => {
      (prisma.userSupplement.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      const { req, res } = mockReqRes("DELETE");
      await handler(req, res);

      expect(prisma.userSupplement.deleteMany).toHaveBeenCalledWith({ where: { id: "us_1", userId: "user_1" } });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("PATCH", () => {
    it("rejects invalid input without touching the database", async () => {
      const { req, res } = mockReqRes("PATCH", { id: "us_1" }, { dosage: "", frequency: "" });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.userSupplement.updateMany).not.toHaveBeenCalled();
    });

    it("returns 404 when not found or not owned, without re-fetching", async () => {
      (prisma.userSupplement.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      const { req, res } = mockReqRes("PATCH", { id: "us_1" }, VALID_PATCH_BODY);
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.userSupplement.findUnique).not.toHaveBeenCalled();
    });

    it("updates an owned supplement and returns the refreshed row", async () => {
      (prisma.userSupplement.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.userSupplement.findUnique as jest.Mock).mockResolvedValue({
        id: "us_1",
        dosage: "10g",
        frequency: "twice daily",
        reason: "Updated dosage",
        supplement: { name: "Creatine Monohydrate", category: "creatine" },
      });

      const { req, res } = mockReqRes("PATCH", { id: "us_1" }, VALID_PATCH_BODY);
      await handler(req, res);

      expect(prisma.userSupplement.updateMany).toHaveBeenCalledWith({
        where: { id: "us_1", userId: "user_1" },
        data: VALID_PATCH_BODY,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.supplement.dosage).toBe("10g");
    });
  });
});
