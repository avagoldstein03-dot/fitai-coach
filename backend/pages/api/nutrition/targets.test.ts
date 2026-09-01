import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./targets";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
  },
}));

const BASE_USER = {
  weight: 70,
  height: 165,
  age: 50,
  sex: "female",
  activityLevel: "moderately_active",
  goal: { primaryGoal: "general_health" },
  lifeStage: null as string | null,
};

function mockReqRes() {
  const req = { method: "GET" } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("nutrition/targets handler — life-stage protein bump", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
  });

  it("bumps the protein target by weight * 0.2 for menopause", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, lifeStage: "menopause" });
    const { req, res } = mockReqRes();

    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    // default proteinPerKg for general_health goal is 1.6, bumped to 1.8
    expect(body.data.proteinTarget).toBe(Math.round(70 * 1.8));
    expect(body.data.proteinAdjusted).toBe(true);
  });

  it("applies the same bump for perimenopause and postmenopause", async () => {
    for (const lifeStage of ["perimenopause", "postmenopause"]) {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, lifeStage });
      const { req, res } = mockReqRes();
      await handler(req, res);
      const body = res.json.mock.calls[0][0];
      expect(body.data.proteinTarget).toBe(Math.round(70 * 1.8));
    }
  });

  it("does not bump for not_applicable, prefer_not_to_say, or null", async () => {
    for (const lifeStage of ["not_applicable", "prefer_not_to_say", null]) {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, lifeStage });
      const { req, res } = mockReqRes();
      await handler(req, res);
      const body = res.json.mock.calls[0][0];
      expect(body.data.proteinTarget).toBe(Math.round(70 * 1.6));
      expect(body.data.proteinAdjusted).toBe(false);
    }
  });
});
