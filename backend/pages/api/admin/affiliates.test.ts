import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    affiliate: { findMany: jest.fn() },
  },
}));

function mockReqRes() {
  const req = { method: "GET" } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("admin/affiliates handler", () => {
  const originalAdmins = process.env.ADMIN_CLERK_IDS;
  let handler: typeof import("./affiliates").default;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_CLERK_IDS = "admin_clerk_1";
    // ADMIN_CLERK_IDS is read from process.env at module-load time, so the
    // module must be re-required (in isolation, keeping the existing
    // @clerk/nextjs/server and @/lib/prisma mocks intact) after the env var
    // is set for each test.
    jest.isolateModules(() => {
      handler = require("./affiliates").default;
    });
  });

  afterAll(() => {
    process.env.ADMIN_CLERK_IDS = originalAdmins;
  });

  it("rejects a non-admin clerk ID", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: "regular_user" });
    const { req, res } = mockReqRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.affiliate.findMany).not.toHaveBeenCalled();
  });

  it("returns correct aggregated totals for an admin", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: "admin_clerk_1" });
    (prisma.affiliate.findMany as jest.Mock).mockResolvedValue([
      {
        code: "CREATO",
        name: "Jane Creator",
        commissionRate: 0.2,
        active: true,
        referrals: [
          {
            commissionEntries: [
              { eventType: "initial_purchase", grossAmount: 19.99, currency: "USD", commissionAmount: 4, status: "pending", createdAt: new Date() },
              { eventType: "renewal", grossAmount: 19.99, currency: "USD", commissionAmount: 4, status: "pending", createdAt: new Date() },
            ],
          },
          { commissionEntries: [] },
        ],
      },
    ]);

    const { req, res } = mockReqRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.data.affiliates).toHaveLength(1);
    expect(body.data.affiliates[0]).toMatchObject({
      code: "CREATO",
      referredUserCount: 2,
      totalPendingCommission: 8,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
