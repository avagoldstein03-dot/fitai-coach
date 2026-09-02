import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import handler from "@/pages/api/webhooks/revenuecat";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    subscription: { upsert: jest.fn(), update: jest.fn() },
    affiliateReferral: { findUnique: jest.fn() },
    commissionEntry: { create: jest.fn() },
  },
}));

const SECRET = "test-webhook-secret";

function mockReqRes(body: any, authHeader?: string) {
  const req = {
    method: "POST",
    headers: authHeader !== undefined ? { authorization: authHeader } : {},
    body,
  } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("webhooks/revenuecat handler", () => {
  const originalSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = originalSecret;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.affiliateReferral.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it("rejects requests with a missing Authorization header", async () => {
    const { req, res } = mockReqRes({ event: { type: "INITIAL_PURCHASE" } });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects requests with a wrong Authorization header", async () => {
    const { req, res } = mockReqRes({ event: { type: "INITIAL_PURCHASE" } }, "wrong-secret");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("grants the correct tier on INITIAL_PURCHASE", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });

    const { req, res } = mockReqRes(
      {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "clerk_abc",
          entitlement_ids: ["elite"],
          purchased_at_ms: 1_700_000_000_000,
          expiration_at_ms: 1_800_000_000_000,
        },
      },
      SECRET
    );

    await handler(req, res);

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkId: "clerk_abc" } })
    );
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        create: expect.objectContaining({ tier: "elite", source: "revenuecat", plan: "premium" }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("resolves the highest tier when multiple entitlements are present", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_2" });

    const { req, res } = mockReqRes(
      {
        event: {
          type: "RENEWAL",
          app_user_id: "clerk_def",
          entitlement_ids: ["starter", "elite"],
          purchased_at_ms: 1_700_000_000_000,
          expiration_at_ms: 1_800_000_000_000,
        },
      },
      SECRET
    );

    await handler(req, res);

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tier: "elite" }),
      })
    );
  });

  it("marks the subscription canceled on EXPIRATION", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_3" });
    (prisma.subscription.update as jest.Mock).mockResolvedValue({});

    const { req, res } = mockReqRes(
      { event: { type: "EXPIRATION", app_user_id: "clerk_ghi" } },
      SECRET
    );

    await handler(req, res);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_3" },
        data: expect.objectContaining({ status: "canceled" }),
      })
    );
  });

  it("does not write to the database for an unrecognized event type", async () => {
    const { req, res } = mockReqRes(
      { event: { type: "CANCELLATION", app_user_id: "clerk_jkl" } },
      SECRET
    );

    await handler(req, res);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  describe("affiliate commission capture", () => {
    const REFERRAL = { id: "ref_1", affiliate: { commissionRate: 0.2 } };

    it("creates a commission entry on INITIAL_PURCHASE for a referred user", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
      (prisma.affiliateReferral.findUnique as jest.Mock).mockResolvedValue(REFERRAL);

      const { req, res } = mockReqRes(
        {
          event: {
            id: "evt_1",
            type: "INITIAL_PURCHASE",
            app_user_id: "clerk_abc",
            entitlement_ids: ["elite"],
            purchased_at_ms: 1_700_000_000_000,
            expiration_at_ms: 1_800_000_000_000,
            price: 19.99,
            currency: "USD",
          },
        },
        SECRET
      );

      await handler(req, res);

      expect(prisma.commissionEntry.create).toHaveBeenCalledWith({
        data: {
          referralId: "ref_1",
          providerEventId: "evt_1",
          eventType: "initial_purchase",
          grossAmount: 19.99,
          currency: "USD",
          commissionAmount: 19.99 * 0.2,
        },
      });
    });

    it("creates a renewal-typed entry on RENEWAL", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_2" });
      (prisma.affiliateReferral.findUnique as jest.Mock).mockResolvedValue(REFERRAL);

      const { req, res } = mockReqRes(
        {
          event: {
            id: "evt_2",
            type: "RENEWAL",
            app_user_id: "clerk_def",
            entitlement_ids: ["elite"],
            purchased_at_ms: 1_700_000_000_000,
            expiration_at_ms: 1_800_000_000_000,
            price: 15.99,
            currency: "USD",
          },
        },
        SECRET
      );

      await handler(req, res);

      expect(prisma.commissionEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: "renewal" }) })
      );
    });

    it("creates no entry for a non-referred user", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_3" });
      (prisma.affiliateReferral.findUnique as jest.Mock).mockResolvedValue(null);

      const { req, res } = mockReqRes(
        {
          event: {
            id: "evt_3",
            type: "INITIAL_PURCHASE",
            app_user_id: "clerk_ghi",
            entitlement_ids: ["elite"],
            purchased_at_ms: 1_700_000_000_000,
            expiration_at_ms: 1_800_000_000_000,
            price: 19.99,
            currency: "USD",
          },
        },
        SECRET
      );

      await handler(req, res);

      expect(prisma.commissionEntry.create).not.toHaveBeenCalled();
    });

    it("creates no entry when price is missing or zero", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_4" });
      (prisma.affiliateReferral.findUnique as jest.Mock).mockResolvedValue(REFERRAL);

      const { req, res } = mockReqRes(
        {
          event: {
            id: "evt_4",
            type: "INITIAL_PURCHASE",
            app_user_id: "clerk_jkl",
            entitlement_ids: ["elite"],
            purchased_at_ms: 1_700_000_000_000,
            expiration_at_ms: 1_800_000_000_000,
          },
        },
        SECRET
      );

      await handler(req, res);

      expect(prisma.commissionEntry.create).not.toHaveBeenCalled();
    });

    it("does not throw when a replayed event hits the unique-constraint guard", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_5" });
      (prisma.affiliateReferral.findUnique as jest.Mock).mockResolvedValue(REFERRAL);
      (prisma.commissionEntry.create as jest.Mock).mockRejectedValue({ code: "P2002" });

      const { req, res } = mockReqRes(
        {
          event: {
            id: "evt_5",
            type: "INITIAL_PURCHASE",
            app_user_id: "clerk_mno",
            entitlement_ids: ["elite"],
            purchased_at_ms: 1_700_000_000_000,
            expiration_at_ms: 1_800_000_000_000,
            price: 19.99,
            currency: "USD",
          },
        },
        SECRET
      );

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
