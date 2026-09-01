import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { AIProviderRegistry } from "@/services/ai-registry";
import { generateShoppingList } from "@/lib/shopping-list";
import handler from "./plan";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    nutritionPlan: { findUnique: jest.fn(), upsert: jest.fn() },
    analyticsEvent: { create: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

jest.mock("@/services/ai-registry", () => ({
  AIProviderRegistry: { getProviderForTask: jest.fn() },
}));

jest.mock("@/lib/shopping-list", () => ({
  generateShoppingList: jest.fn(),
}));

const BASE_USER = {
  id: "user_1",
  weight: 70,
  goal: { primaryGoal: "general_health" },
  activityLevel: "moderately_active",
  dietPreferences: [],
  foodAllergies: [],
  lifeStage: null as string | null,
};

function mockReqRes() {
  const req = { method: "POST" } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("nutrition/plan handler — life-stage protein bump", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { unlimitedMealPlans: true }, tier: "pro" });
    (prisma.nutritionPlan.findUnique as jest.Mock).mockResolvedValue(null);
    (AIProviderRegistry.getProviderForTask as jest.Mock).mockReturnValue({
      generateMealPlan: jest.fn().mockResolvedValue({ days: [] }),
    });
    (generateShoppingList as jest.Mock).mockReturnValue([]);
    (prisma.nutritionPlan.upsert as jest.Mock).mockImplementation(({ create }: any) => Promise.resolve(create));
  });

  it("bumps proteinTarget by weight * 0.2 when lifeStage is menopause-adjacent", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, lifeStage: "perimenopause" });
    const { req, res } = mockReqRes();

    await handler(req, res);

    expect(prisma.nutritionPlan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ proteinTarget: Math.round(70 * 2.2) }),
      })
    );
  });

  it("uses the unbumped protein target for not_applicable/null", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, lifeStage: null });
    const { req, res } = mockReqRes();

    await handler(req, res);

    expect(prisma.nutritionPlan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ proteinTarget: Math.round(70 * 2) }),
      })
    );
  });
});
