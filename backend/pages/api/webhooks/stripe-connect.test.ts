import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import stripe from "@/services/stripe-service";
import handler from "./stripe-connect";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    affiliate: { updateMany: jest.fn() },
  },
}));

jest.mock("@/services/stripe-service", () => ({
  __esModule: true,
  default: {
    webhooks: { constructEvent: jest.fn() },
  },
}));

function mockReqRes(body: any, sig = "test-sig") {
  const req = {
    method: "POST",
    headers: sig ? { "stripe-signature": sig } : {},
    body,
  } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("webhooks/stripe-connect handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.affiliate.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it("rejects a request with no signature header", async () => {
    const { req, res } = mockReqRes({ type: "account.updated" }, "");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it("rejects a request with an invalid signature", async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error("bad signature");
    });
    const { req, res } = mockReqRes({ type: "account.updated" });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("marks the affiliate onboarding complete when both capabilities are enabled", async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "account.updated",
      data: { object: { id: "acct_123", charges_enabled: true, payouts_enabled: true } },
    });
    const { req, res } = mockReqRes({});

    await handler(req, res);

    expect(prisma.affiliate.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: "acct_123" },
      data: { stripeOnboardingComplete: true },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does nothing when either capability flag is still false", async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "account.updated",
      data: { object: { id: "acct_456", charges_enabled: true, payouts_enabled: false } },
    });
    const { req, res } = mockReqRes({});

    await handler(req, res);

    expect(prisma.affiliate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does not throw for an unrecognized event type", async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "account.application.deauthorized",
      data: { object: {} },
    });
    const { req, res } = mockReqRes({});

    await handler(req, res);

    expect(prisma.affiliate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
