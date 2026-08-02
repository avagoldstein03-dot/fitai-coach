import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { deleteS3Object } from "@/lib/s3";
import handler from "./history";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: jest.fn() },
    bodyScan: { findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  },
}));

jest.mock("@/lib/s3", () => ({
  deleteS3Object: jest.fn(),
}));

function mockReqRes(method: string, query: Record<string, unknown> = {}) {
  const req = { method, query } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("assessment/history handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (prisma.bodyScan.findMany as jest.Mock).mockResolvedValue([]);
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
    it("returns the user's scans", async () => {
      (prisma.bodyScan.findMany as jest.Mock).mockResolvedValue([
        { id: "scan_1", createdAt: new Date(), analysisStatus: "completed", frontImageUrl: "a", sideImageUrl: "b", backImageUrl: "c", assessment: null },
      ]);
      const { req, res } = mockReqRes("GET");
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.count).toBe(1);
    });
  });

  describe("DELETE", () => {
    it("rejects a missing scanId", async () => {
      const { req, res } = mockReqRes("DELETE", {});
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("rejects deleting a scan that belongs to another user", async () => {
      (prisma.bodyScan.findUnique as jest.Mock).mockResolvedValue({ id: "scan_1", userId: "someone_else" });
      const { req, res } = mockReqRes("DELETE", { scanId: "scan_1" });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.bodyScan.delete).not.toHaveBeenCalled();
    });

    it("deletes S3 images for every populated image field, skipping nulls", async () => {
      (prisma.bodyScan.findUnique as jest.Mock).mockResolvedValue({
        id: "scan_1", userId: "user_1",
        frontImageUrl: "https://s3/front.jpg", sideImageUrl: null, backImageUrl: "https://s3/back.jpg",
      });
      const { req, res } = mockReqRes("DELETE", { scanId: "scan_1" });
      await handler(req, res);

      expect(deleteS3Object).toHaveBeenCalledTimes(2);
      expect(deleteS3Object).toHaveBeenCalledWith("https://s3/front.jpg");
      expect(deleteS3Object).toHaveBeenCalledWith("https://s3/back.jpg");
      expect(prisma.bodyScan.delete).toHaveBeenCalledWith({ where: { id: "scan_1" } });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
