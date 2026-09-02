import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { AIProviderRegistry } from "@/services/ai-registry";
import handler from "./generate";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    workoutProgram: { count: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    goal: { upsert: jest.fn() },
    bodyAssessment: { findFirst: jest.fn() },
    analyticsEvent: { create: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

jest.mock("@/services/ai-registry", () => ({
  AIProviderRegistry: { getProviderForTask: jest.fn() },
}));

const BASE_USER = {
  id: "user_1",
  goal: { primaryGoal: "general_health" },
  fitnessExperience: "beginner",
  sex: "female",
  injuryHistory: null as string | null,
};

function mockReqRes(body: Record<string, unknown> = {}) {
  const req = { method: "POST", body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("workouts/generate handler — injury-aware generation", () => {
  let generateWorkout: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { unlimitedWorkouts: true } });
    (prisma.workoutProgram.count as jest.Mock).mockResolvedValue(0);
    (prisma.bodyAssessment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.workoutProgram.updateMany as jest.Mock).mockResolvedValue({});
    generateWorkout = jest.fn().mockResolvedValue({
      coachNote: "Great program",
      weeks: [
        {
          weekNumber: 1,
          progressionStrategy: "linear",
          days: [
            {
              dayOfWeek: 0,
              exercises: [
                { exerciseName: "Squat", sets: 3, reps: "8-10", restSeconds: 90, category: "strength" },
                { exerciseName: "Hip Flexor Stretch", sets: 2, reps: "30s", restSeconds: 15, category: "mobility" },
                { exerciseName: "Old-Style Exercise", sets: 3, reps: "10", restSeconds: 60 },
              ],
            },
          ],
        },
      ],
    });
    (AIProviderRegistry.getProviderForTask as jest.Mock).mockReturnValue({ generateWorkout });
    (prisma.workoutProgram.create as jest.Mock).mockImplementation(({ data }: any) => Promise.resolve({ id: "program_1", ...data }));
  });

  it("passes injuryHistory (truncated) to the AI provider when the user has one", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_USER,
      injuryHistory: "a".repeat(400),
    });
    const { req, res } = mockReqRes();

    await handler(req, res);

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ injuryHistory: "a".repeat(300) })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("omits injuryHistory from the input when the user has none", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, injuryHistory: null });
    const { req, res } = mockReqRes();

    await handler(req, res);

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ injuryHistory: undefined })
    );
  });

  it("persists each exercise's category, defaulting to strength when the AI omits it", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, injuryHistory: "bad knee" });
    const { req, res } = mockReqRes();

    await handler(req, res);

    const createCall = (prisma.workoutProgram.create as jest.Mock).mock.calls[0][0];
    const exercises = createCall.data.weeks.create[0].days.create[0].exercises.create;
    expect(exercises).toEqual([
      expect.objectContaining({ exerciseName: "Squat", category: "strength" }),
      expect.objectContaining({ exerciseName: "Hip Flexor Stretch", category: "mobility" }),
      expect.objectContaining({ exerciseName: "Old-Style Exercise", category: "strength" }),
    ]);
  });
});
