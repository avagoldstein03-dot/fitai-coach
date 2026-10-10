import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./goal";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    goal: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

function mockReqRes(method: string, body: Record<string, unknown> = {}) {
  const req = { method, body, query: {} } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("goal handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1", weight: 82, medicalConditions: [] });
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = mockReqRes("POST");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("GET returns the current goal", async () => {
    (prisma.goal.findUnique as jest.Mock).mockResolvedValue({ id: "goal_1", primaryGoal: "fat_loss" });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data.goal.primaryGoal).toBe("fat_loss");
  });

  it("PATCH upserts the primary goal without touching onboardingStep", async () => {
    (prisma.goal.upsert as jest.Mock).mockResolvedValue({ id: "goal_1", primaryGoal: "muscle_gain" });
    const { req, res } = mockReqRes("PATCH", { primaryGoal: "muscle_gain" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = (prisma.goal.upsert as jest.Mock).mock.calls[0][0];
    expect(call.update.primaryGoal).toBe("muscle_gain");
    expect(call.create).toMatchObject({ userId: "user_1", primaryGoal: "muscle_gain" });
    // Fields that were not sent stay untouched rather than being overwritten.
    expect(call.update.targetWeight).toBeUndefined();
    expect(call.update.timeline).toBeUndefined();
  });

  it("rejects an invalid primaryGoal value", async () => {
    const { req, res } = mockReqRes("PATCH", { primaryGoal: "get_ripped_fast" });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.goal.upsert).not.toHaveBeenCalled();
  });
});

describe("goal handler — target weight and timeline", () => {
  // Onboarding collected both and then froze them: the editor only accepted
  // primaryGoal, so a target set on day one was permanent.
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1", weight: 82, medicalConditions: [] });
    (prisma.goal.upsert as jest.Mock).mockResolvedValue({ id: "goal_1" });
  });

  it("accepts a new target weight and timeline", async () => {
    const { req, res } = mockReqRes("PATCH", { targetWeight: 68.5, timeline: 16 });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = (prisma.goal.upsert as jest.Mock).mock.calls[0][0];
    expect(call.update).toMatchObject({ targetWeight: 68.5, timeline: 16 });
  });

  it("updates the goal and its target together", async () => {
    const { req, res } = mockReqRes("PATCH", {
      primaryGoal: "fat_loss",
      targetWeight: 70,
      timeline: 12,
    });
    await handler(req, res);
    const call = (prisma.goal.upsert as jest.Mock).mock.calls[0][0];
    expect(call.update).toMatchObject({ primaryGoal: "fat_loss", targetWeight: 70, timeline: 12 });
  });

  it("snapshots the current weight when a target is set", async () => {
    // Progress needs a start point and weight history only exists for people
    // who connected Apple Health, so the snapshot is the only thing that makes
    // progress measurable for everyone else.
    const { req, res } = mockReqRes("PATCH", { targetWeight: 70 });
    await handler(req, res);
    const call = (prisma.goal.upsert as jest.Mock).mock.calls[0][0];
    expect(call.update.startWeight).toBe(82); // the mocked user's current weight
    expect(call.update.targetSetAt).toBeInstanceOf(Date);
  });

  it("clears the snapshot when the target is cleared", async () => {
    // Otherwise a target set next year would measure from a weight recorded now.
    const { req, res } = mockReqRes("PATCH", { targetWeight: null });
    await handler(req, res);
    const call = (prisma.goal.upsert as jest.Mock).mock.calls[0][0];
    expect(call.update.startWeight).toBeNull();
    expect(call.update.targetSetAt).toBeNull();
  });

  it("leaves the snapshot alone when only the goal type changes", async () => {
    const { req, res } = mockReqRes("PATCH", { primaryGoal: "muscle_gain" });
    await handler(req, res);
    const call = (prisma.goal.upsert as jest.Mock).mock.calls[0][0];
    expect(call.update.startWeight).toBeUndefined();
    expect(call.update.targetSetAt).toBeUndefined();
  });

  it("lets an explicit null clear a target someone has passed", async () => {
    const { req, res } = mockReqRes("PATCH", { targetWeight: null, timeline: null });
    await handler(req, res);
    const call = (prisma.goal.upsert as jest.Mock).mock.calls[0][0];
    expect(call.update.targetWeight).toBeNull();
    expect(call.update.timeline).toBeNull();
  });

  it("still creates a valid row when only a target is sent", async () => {
    // primaryGoal is required on the row, so a create carrying only a target
    // weight would otherwise write a goal with no goal in it.
    const { req, res } = mockReqRes("PATCH", { targetWeight: 70 });
    await handler(req, res);
    const call = (prisma.goal.upsert as jest.Mock).mock.calls[0][0];
    expect(call.create.primaryGoal).toBe("general_health");
  });

  it("rejects an empty body rather than upserting an empty goal", async () => {
    const { req, res } = mockReqRes("PATCH", {});
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.goal.upsert).not.toHaveBeenCalled();
  });

  it("rejects implausible targets", async () => {
    for (const body of [
      { targetWeight: 5 },
      { targetWeight: 900 },
      { timeline: 0 },
      { timeline: 500 },
      { timeline: 4.5 },
    ]) {
      jest.clearAllMocks();
      const { req, res } = mockReqRes("PATCH", body);
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.goal.upsert).not.toHaveBeenCalled();
    }
  });
});

describe("goal handler — progress, and when not to show it", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.goal.findUnique as jest.Mock).mockResolvedValue({
      id: "goal_1",
      primaryGoal: "fat_loss",
      targetWeight: 70,
      timeline: 20,
      startWeight: 80,
      targetSetAt: new Date(Date.now() - 10 * 7 * 24 * 60 * 60 * 1000),
    });
  });

  async function getGoal(medicalConditions: string[]) {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      weight: 75,
      medicalConditions,
    });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    return res.json.mock.calls[0][0].data;
  }

  it("returns progress toward the target", async () => {
    const data = await getGoal([]);
    expect(data.showWeightTarget).toBe(true);
    expect(data.progress.percentComplete).toBe(50);
    expect(data.progress.remainingKg).toBe(5);
    expect(data.progress.pace).toBe("on_track");
  });

  it("withholds it entirely for a disordered-eating history", async () => {
    // Decided server-side so the client cannot show it by forgetting to check.
    const data = await getGoal(["disordered_eating_history"]);
    expect(data.showWeightTarget).toBe(false);
    expect(data.progress).toBeNull();
  });

  it("withholds it during pregnancy, where the calorie target refuses a deficit", async () => {
    const data = await getGoal(["pregnant_or_postpartum"]);
    expect(data.showWeightTarget).toBe(false);
    expect(data.progress).toBeNull();
  });

  it("still returns the goal itself when the weight target is withheld", async () => {
    // The goal type is not the problem; only the scale countdown is.
    const data = await getGoal(["disordered_eating_history"]);
    expect(data.goal.primaryGoal).toBe("fat_loss");
  });

  it("returns null progress rather than zeroes when no target is set", async () => {
    (prisma.goal.findUnique as jest.Mock).mockResolvedValue({
      id: "goal_1", primaryGoal: "general_health",
      targetWeight: null, timeline: null, startWeight: null, targetSetAt: null,
    });
    const data = await getGoal([]);
    expect(data.progress).toBeNull();
  });
});
