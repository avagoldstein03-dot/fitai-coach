import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { lookupProduct } from "@/services/openfoodfacts-provider";
import { SCORING_VERSION } from "@/lib/ingredient-score";
import handler from "./scan";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    productScan: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock("@/services/openfoodfacts-provider", () => ({
  lookupProduct: jest.fn(),
}));

const VALID_BODY = { barcode: "0123456789012" };

function mockReqRes(method: string, body: Record<string, unknown> = VALID_BODY) {
  const req = { method, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

const OFF_PRODUCT = {
  productName: "Test Cereal",
  brand: "Test Brand",
  imageUrl: "https://example.com/img.jpg",
  ingredientsText: "wheat, sugar, e171",
  additivesTags: ["en:e171"],
  novaGroup: 4,
  nutriscoreGrade: "d",
};

describe("products/scan handler", () => {
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

  it("rejects an invalid barcode without touching the database or rate limiter", async () => {
    const { req, res } = mockReqRes("POST", { barcode: "abc" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.productScan.findUnique).not.toHaveBeenCalled();
  });

  it("rejects rate-limited requests without touching the database or Open Food Facts", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(false);
    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(prisma.productScan.findUnique).not.toHaveBeenCalled();
    expect(lookupProduct).not.toHaveBeenCalled();
  });

  it("returns a cached row as-is when the scoring version is current", async () => {
    (prisma.productScan.findUnique as jest.Mock).mockResolvedValue({
      barcode: VALID_BODY.barcode,
      scoringVersion: SCORING_VERSION,
      score: 40,
      grade: "mediocre",
    });

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(lookupProduct).not.toHaveBeenCalled();
    expect(prisma.productScan.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data.status).toBe("found");
    expect(data.cacheHit).toBe(true);
  });

  it("recomputes from cached raw fields (no re-fetch) when the scoring version is stale", async () => {
    (prisma.productScan.findUnique as jest.Mock).mockResolvedValue({
      barcode: VALID_BODY.barcode,
      scoringVersion: SCORING_VERSION - 1,
      novaGroup: 4,
      nutriscoreGrade: "d",
      additivesTags: ["en:e171"],
    });
    (prisma.productScan.update as jest.Mock).mockResolvedValue({ barcode: VALID_BODY.barcode });

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(lookupProduct).not.toHaveBeenCalled();
    expect(prisma.productScan.update).toHaveBeenCalledWith({
      where: { barcode: VALID_BODY.barcode },
      data: expect.objectContaining({ scoringVersion: SCORING_VERSION }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("looks up and caches a new product on a cache miss", async () => {
    (lookupProduct as jest.Mock).mockResolvedValue(OFF_PRODUCT);
    (prisma.productScan.upsert as jest.Mock).mockResolvedValue({
      barcode: VALID_BODY.barcode,
      ...OFF_PRODUCT,
    });

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(lookupProduct).toHaveBeenCalledWith(VALID_BODY.barcode);
    expect(prisma.productScan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { barcode: VALID_BODY.barcode } })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data.status).toBe("found");
    expect(data.cacheHit).toBe(false);
  });

  it("returns a not_found status without writing to the database when Open Food Facts has no data", async () => {
    (lookupProduct as jest.Mock).mockResolvedValue(null);

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(prisma.productScan.upsert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data.status).toBe("not_found");
    expect(data.barcode).toBe(VALID_BODY.barcode);
  });

  it("returns a 502 without writing to the database when Open Food Facts is unreachable", async () => {
    (lookupProduct as jest.Mock).mockRejectedValue(new Error("network error"));

    const { req, res } = mockReqRes("POST");
    await handler(req, res);

    expect(prisma.productScan.upsert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(502);
  });
});
