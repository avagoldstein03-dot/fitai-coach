import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import handler from "./index";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    workoutDay: { findFirst: jest.fn() },
    exercise: { create: jest.fn() },
  },
}));

const VALID_BODY = {
  dayId: "day_1",
  exerciseName: "Bulgarian Split Squat",
  sets: 3,
  reps: "8-10",
  restSeconds: 90,
};

function mockReqRes(body: Record<string, unknown> = VALID_BODY, method = "POST") {
  const req = { method, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("workouts/exercises (POST) handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.workoutDay.findFirst as jest.Mock).mockResolvedValue({ id: "day_1" });
    (prisma.exercise.create as jest.Mock).mockResolvedValue({ id: "ex_1", ...VALID_BODY });
  });

  it("rejects non-POST methods", async () => {
    const { req, res } = mockReqRes(VALID_BODY, "GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects invalid input without touching the database", async () => {
    const { req, res } = mockReqRes({ dayId: "day_1", exerciseName: "", sets: -1, reps: "", restSeconds: 90 });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it("rejects when the day isn't found or isn't owned by the user", async () => {
    (prisma.workoutDay.findFirst as jest.Mock).mockResolvedValue(null);
    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it("creates the exercise on an owned day", async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(prisma.workoutDay.findFirst).toHaveBeenCalledWith({
      where: { id: "day_1", week: { program: { user: { clerkId: "clerk_1" } } } },
      select: { id: true },
    });
    expect(prisma.exercise.create).toHaveBeenCalledWith({
      data: {
        dayId: "day_1",
        exerciseName: "Bulgarian Split Squat",
        sets: 3,
        reps: "8-10",
        restSeconds: 90,
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.data.exercise.id).toBe("ex_1");
  });
});
