import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import handler from "./manual";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    productScan: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

const VALID_BODY = { barcode: "269340511090", productName: "Atlantic Salmon" };

function mockReqRes(method: string, body: Record<string, unknown> = VALID_BODY) {
  const req = { method, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("products/manual handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    (prisma.productScan.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes("POST");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects a missing product name", async () => {
    const { req, res } = mockReqRes("POST", { barcode: "269340511090", productName: "" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.productScan.create).not.toHaveBeenCalled();
  });

  it("creates a new row marked isUserSubmitted when the barcode isn't cached yet", async () => {
    (prisma.productScan.create as jest.Mock).mockResolvedValue({
      barcode: VALID_BODY.barcode,
      productName: "Atlantic Salmon",
      isUserSubmitted: true,
    });

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(prisma.productScan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ barcode: VALID_BODY.barcode, isUserSubmitted: true }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data.status).toBe("found");
    expect(data.product.isUserSubmitted).toBe(true);
  });

  it("does not overwrite an existing row (from Open Food Facts or a prior submission)", async () => {
    (prisma.productScan.findUnique as jest.Mock).mockResolvedValue({
      barcode: VALID_BODY.barcode,
      productName: "Existing Product",
      isUserSubmitted: false,
    });

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(prisma.productScan.create).not.toHaveBeenCalled();
    const { data } = res.json.mock.calls[0][0];
    expect(data.product.productName).toBe("Existing Product");
  });
});
