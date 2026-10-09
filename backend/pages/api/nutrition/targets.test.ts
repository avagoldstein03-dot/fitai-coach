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

describe("nutrition/targets handler — health guards on the calorie target", () => {
  // The formula is otherwise purely mechanical: fat_loss means tdee - 500
  // whatever the person has told the app about themselves. These are the cases
  // where that was the wrong answer.
  const FAT_LOSS = { ...BASE_USER, goal: { primaryGoal: "fat_loss" } };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
  });

  async function targetsFor(user: Record<string, unknown>) {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    const { req, res } = mockReqRes();
    await handler(req, res);
    return res.json.mock.calls[0][0].data;
  }

  it("still applies the full deficit when nothing is reported", async () => {
    const body = await targetsFor({ ...FAT_LOSS, medicalConditions: [] });
    expect(body.dailyCaloricTarget).toBe(body.tdee - 500);
    expect(body.calorieNote).toBeNull();
  });

  it("holds a pregnant user at maintenance instead of a deficit", async () => {
    const body = await targetsFor({
      ...FAT_LOSS,
      medicalConditions: ["pregnant_or_postpartum"],
    });
    expect(body.dailyCaloricTarget).toBe(body.tdee);
    expect(body.calorieNote).toContain("maintenance");
  });

  it("caps rather than removes the deficit for a disordered-eating history", async () => {
    const body = await targetsFor({
      ...FAT_LOSS,
      medicalConditions: ["disordered_eating_history"],
    });
    expect(body.dailyCaloricTarget).toBe(body.tdee - 250);
    expect(body.calorieNote).toContain("250");
  });

  it("derives protein, carbs and fat from the guarded figure, not the raw one", async () => {
    const guarded = await targetsFor({
      ...FAT_LOSS,
      medicalConditions: ["pregnant_or_postpartum"],
    });
    const unguarded = await targetsFor({ ...FAT_LOSS, medicalConditions: [] });
    // Fat is a straight percentage of calories, so it has to move with them.
    expect(guarded.fatsTarget).toBeGreaterThan(unguarded.fatsTarget);
  });

  it("holds carbs above the floor for a condition where cutting them is the risk", async () => {
    const body = await targetsFor({
      ...FAT_LOSS,
      medicalConditions: ["diabetes_type_2"],
    });
    expect(body.carbsTarget).toBeGreaterThanOrEqual(130);
  });

  it("leaves a muscle-gain target alone — the guards only ever pull a deficit back", async () => {
    const body = await targetsFor({
      ...BASE_USER,
      goal: { primaryGoal: "muscle_gain" },
      medicalConditions: ["pregnant_or_postpartum"],
    });
    expect(body.dailyCaloricTarget).toBe(body.tdee + 300);
  });

  it("infers nothing from 'prefer not to say'", async () => {
    const body = await targetsFor({
      ...FAT_LOSS,
      medicalConditions: ["prefer_not_to_say"],
    });
    expect(body.dailyCaloricTarget).toBe(body.tdee - 500);
    expect(body.calorieNote).toBeNull();
  });

  it("does not break for a user whose conditions were never recorded", async () => {
    const body = await targetsFor(FAT_LOSS);
    expect(body.dailyCaloricTarget).toBe(body.tdee - 500);
  });
});
