import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { AIProviderRegistry } from "@/services/ai-registry";
import { generateShoppingList } from "@/lib/shopping-list";
import handler from "./plan";
import { calculateTDEE, calculateMacros } from "@/lib/nutrition-targets";

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

  async function storedTargets(user: Record<string, unknown>) {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    const { req, res } = mockReqRes();
    await handler(req, res);
    // The last call, not the first — a test comparing two profiles invokes this
    // twice and would otherwise read the same result both times.
    const calls = (prisma.nutritionPlan.upsert as jest.Mock).mock.calls;
    return calls[calls.length - 1][0].create;
  }

  // The absolute figures changed here when the two formulas were unified: this
  // endpoint used a flat 2.0 g/kg while /api/nutrition/targets used a
  // goal-based scale (1.6 for general_health). Both numbers were shown on the
  // same screen. The bump itself is unchanged and is what these assert.
  it("bumps proteinTarget by weight * 0.2 when lifeStage is menopause-adjacent", async () => {
    const bumped = await storedTargets({ ...BASE_USER, lifeStage: "perimenopause" });
    const plain = await storedTargets({ ...BASE_USER, lifeStage: null });
    expect(bumped.proteinTarget - plain.proteinTarget).toBe(Math.round(70 * 0.2));
  });

  it("uses the unbumped protein target for not_applicable/null", async () => {
    for (const lifeStage of ["not_applicable", null]) {
      jest.clearAllMocks();
      (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
      (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { unlimitedMealPlans: true }, tier: "pro" });
      (prisma.nutritionPlan.findUnique as jest.Mock).mockResolvedValue(null);
      (AIProviderRegistry.getProviderForTask as jest.Mock).mockReturnValue({
        generateMealPlan: jest.fn().mockResolvedValue({ days: [] }),
      });
      (generateShoppingList as jest.Mock).mockReturnValue([]);
      (prisma.nutritionPlan.upsert as jest.Mock).mockImplementation(({ create }: any) => Promise.resolve(create));
      const t = await storedTargets({ ...BASE_USER, lifeStage });
      expect(t.proteinTarget).toBe(Math.round(70 * 1.6));
    }
  });

  it("stores the same figures /api/nutrition/targets would compute", async () => {
    // The actual bug: the Nutrition screen renders the computed target at the
    // top of the page and this stored one in the meal-plan card below it, so
    // any disagreement is two different calorie numbers on one screen.
    const COMPLETE = {
      ...BASE_USER,
      height: 165,
      age: 50,
      sex: "female",
      goal: { primaryGoal: "fat_loss" },
      medicalConditions: [],
    };
    const stored = await storedTargets(COMPLETE);
    const tdee = calculateTDEE(70, 165, 50, "female", "moderately_active");
    const expected = calculateMacros(tdee, "fat_loss", 70, null, null);

    expect(stored.dailyCaloricTarget).toBe(expected.calories);
    expect(stored.proteinTarget).toBe(expected.protein);
    expect(stored.carbsTarget).toBe(expected.carbs);
    expect(stored.fatsTarget).toBe(expected.fat);
  });

  it("still generates a plan with rough numbers when the profile is incomplete", async () => {
    // A missing height must not stop a meal plan from being generated.
    const stored = await storedTargets({ ...BASE_USER, height: null, age: null, sex: null });
    expect(stored.dailyCaloricTarget).toBe(70 * 30);
  });

  it("holds a pregnant user's stored target at maintenance", async () => {
    const stored = await storedTargets({
      ...BASE_USER,
      height: 165, age: 30, sex: "female",
      goal: { primaryGoal: "fat_loss" },
      medicalConditions: ["pregnant_or_postpartum"],
    });
    const tdee = calculateTDEE(70, 165, 30, "female", "moderately_active");
    expect(stored.dailyCaloricTarget).toBe(Math.round(tdee));
  });
});
