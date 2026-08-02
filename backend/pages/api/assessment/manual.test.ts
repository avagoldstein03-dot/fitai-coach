import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./manual";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    manualMeasurement: { findUnique: jest.fn(), upsert: jest.fn() },
    bodyAssessment: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    analyticsEvent: { create: jest.fn() },
  },
}));

const VALID_BODY = { waist: 80, chest: 100, hips: 95, neck: 38 };

function mockReqRes(method: string, body: Record<string, unknown> = VALID_BODY) {
  const req = { method, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("assessment/manual handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1", height: 180, sex: "male" });
    (prisma.manualMeasurement.upsert as jest.Mock).mockResolvedValue({ id: "mm_1", ...VALID_BODY });
    (prisma.analyticsEvent.create as jest.Mock).mockResolvedValue({});
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes("POST");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects invalid input", async () => {
    const { req, res } = mockReqRes("POST", { waist: 1 });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates a new manual-measurement assessment when none exists yet", async () => {
    (prisma.bodyAssessment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.bodyAssessment.create as jest.Mock).mockResolvedValue({ id: "ba_1" });

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(prisma.bodyAssessment.findFirst).toHaveBeenCalledWith({
      where: { userId: "user_1", scanId: null },
    });
    expect(prisma.bodyAssessment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user_1" }),
    });
    expect(prisma.bodyAssessment.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates the existing manual-measurement assessment in place on a re-save, instead of creating a duplicate", async () => {
    (prisma.bodyAssessment.findFirst as jest.Mock).mockResolvedValue({ id: "ba_existing" });
    (prisma.bodyAssessment.update as jest.Mock).mockResolvedValue({ id: "ba_existing" });

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(prisma.bodyAssessment.update).toHaveBeenCalledWith({
      where: { id: "ba_existing" },
      data: expect.any(Object),
    });
    expect(prisma.bodyAssessment.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
