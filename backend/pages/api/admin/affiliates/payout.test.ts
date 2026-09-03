import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import stripe from "@/services/stripe-service";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    affiliate: { findUnique: jest.fn() },
    commissionEntry: { updateMany: jest.fn() },
  },
}));

jest.mock("@/services/stripe-service", () => ({
  __esModule: true,
  default: {
    transfers: { create: jest.fn() },
  },
}));

function mockReqRes(body: Record<string, unknown>) {
  const req = { method: "POST", body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

const ONBOARDED_AFFILIATE = {
  id: "aff_1",
  code: "CREATO",
  stripeAccountId: "acct_123",
  stripeOnboardingComplete: true,
  referrals: [
    {
      commissionEntries: [
        { id: "ce_1", status: "pending", currency: "usd", commissionAmount: 4 },
        { id: "ce_2", status: "pending", currency: "usd", commissionAmount: 3.2 },
        { id: "ce_3", status: "paid", currency: "usd", commissionAmount: 5 },
      ],
    },
  ],
};

describe("admin/affiliates/payout handler", () => {
  let handler: typeof import("./payout").default;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_CLERK_IDS = "admin_clerk_1";
    // ADMIN_CLERK_IDS is read from process.env at module-load time, so the
    // module must be re-required (in isolation) after the env var is set.
    jest.isolateModules(() => {
      handler = require("./payout").default;
    });
    (getAuth as jest.Mock).mockReturnValue({ userId: "admin_clerk_1" });
    (prisma.commissionEntry.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
  });

  it("rejects a non-admin", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: "regular_user" });
    const { req, res } = mockReqRes({ code: "CREATO" });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.affiliate.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an affiliate that hasn't finished onboarding", async () => {
    (prisma.affiliate.findUnique as jest.Mock).mockResolvedValue({
      ...ONBOARDED_AFFILIATE,
      stripeOnboardingComplete: false,
    });
    const { req, res } = mockReqRes({ code: "CREATO" });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("rejects when there's nothing pending", async () => {
    (prisma.affiliate.findUnique as jest.Mock).mockResolvedValue({
      ...ONBOARDED_AFFILIATE,
      referrals: [{ commissionEntries: [{ id: "ce_3", status: "paid", currency: "usd", commissionAmount: 5 }] }],
    });
    const { req, res } = mockReqRes({ code: "CREATO" });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("creates a transfer for the correct total and marks entries paid", async () => {
    (prisma.affiliate.findUnique as jest.Mock).mockResolvedValue(ONBOARDED_AFFILIATE);
    (stripe.transfers.create as jest.Mock).mockResolvedValue({ id: "tr_123" });
    const { req, res } = mockReqRes({ code: "creato" });

    await handler(req, res);

    expect(stripe.transfers.create).toHaveBeenCalledWith({
      amount: 720, // (4 + 3.2) * 100
      currency: "usd",
      destination: "acct_123",
    });
    expect(prisma.commissionEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ce_1", "ce_2"] } },
      data: { status: "paid", paidAt: expect.any(Date), stripeTransferId: "tr_123" },
    });
    const body = res.json.mock.calls[0][0];
    expect(body.data.amountPaidUsd).toBe(7.2);
    expect(body.data.entriesPaid).toBe(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("excludes a non-USD entry from the sum instead of mishandling it", async () => {
    (prisma.affiliate.findUnique as jest.Mock).mockResolvedValue({
      ...ONBOARDED_AFFILIATE,
      referrals: [
        {
          commissionEntries: [
            { id: "ce_1", status: "pending", currency: "usd", commissionAmount: 4 },
            { id: "ce_4", status: "pending", currency: "eur", commissionAmount: 3 },
          ],
        },
      ],
    });
    (stripe.transfers.create as jest.Mock).mockResolvedValue({ id: "tr_456" });
    const { req, res } = mockReqRes({ code: "CREATO" });

    await handler(req, res);

    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 400 })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data.skippedNonUsd).toBe(1);
  });

  it("returns a clear error when the Stripe transfer fails", async () => {
    (prisma.affiliate.findUnique as jest.Mock).mockResolvedValue(ONBOARDED_AFFILIATE);
    (stripe.transfers.create as jest.Mock).mockRejectedValue(new Error("Insufficient funds"));
    const { req, res } = mockReqRes({ code: "CREATO" });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(prisma.commissionEntry.updateMany).not.toHaveBeenCalled();
  });
});
