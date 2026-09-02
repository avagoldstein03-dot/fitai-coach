import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./apply-code";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    affiliate: { findUnique: jest.fn() },
    affiliateReferral: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

function mockReqRes(body: Record<string, unknown>) {
  const req = { method: "POST", body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("affiliate/apply-code handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (prisma.affiliateReferral.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it("creates a referral for a valid, active code", async () => {
    (prisma.affiliate.findUnique as jest.Mock).mockResolvedValue({
      id: "aff_1",
      code: "CREATO",
      active: true,
    });
    const { req, res } = mockReqRes({ code: "creato" });

    await handler(req, res);

    expect(prisma.affiliate.findUnique).toHaveBeenCalledWith({ where: { code: "CREATO" } });
    expect(prisma.affiliateReferral.create).toHaveBeenCalledWith({
      data: { affiliateId: "aff_1", userId: "user_1" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("404s on an unknown code", async () => {
    (prisma.affiliate.findUnique as jest.Mock).mockResolvedValue(null);
    const { req, res } = mockReqRes({ code: "NOPECODE" });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.affiliateReferral.create).not.toHaveBeenCalled();
  });

  it("404s on an inactive affiliate's code", async () => {
    (prisma.affiliate.findUnique as jest.Mock).mockResolvedValue({
      id: "aff_1",
      code: "OLDCODE",
      active: false,
    });
    const { req, res } = mockReqRes({ code: "OLDCODE" });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.affiliateReferral.create).not.toHaveBeenCalled();
  });

  it("rejects a user who already has a referral, without overwriting it", async () => {
    (prisma.affiliateReferral.findUnique as jest.Mock).mockResolvedValue({
      id: "ref_1",
      affiliateId: "aff_old",
      userId: "user_1",
    });
    const { req, res } = mockReqRes({ code: "SOMECODE" });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.affiliate.findUnique).not.toHaveBeenCalled();
    expect(prisma.affiliateReferral.create).not.toHaveBeenCalled();
  });

  it("rejects a missing code", async () => {
    const { req, res } = mockReqRes({});
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
