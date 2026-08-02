import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import handler from "./[exerciseId]";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    exercise: { updateMany: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn() },
  },
}));

const VALID_PATCH_BODY = {
  exerciseName: "Goblet Squat",
  sets: 4,
  reps: "10-12",
  restSeconds: 60,
};

const OWNERSHIP_WHERE = {
  id: "ex_1",
  day: { week: { program: { user: { clerkId: "clerk_1" } } } },
};

function mockReqRes(method: string, query: Record<string, unknown> = { exerciseId: "ex_1" }, body: Record<string, unknown> = {}) {
  const req = { method, query, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("workouts/exercises/[exerciseId] handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = mockReqRes("PUT");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  describe("DELETE", () => {
    it("rejects unauthenticated requests", async () => {
      (getAuth as jest.Mock).mockReturnValue({ userId: null });
      const { req, res } = mockReqRes("DELETE");
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("rejects a missing exerciseId", async () => {
      const { req, res } = mockReqRes("DELETE", {});
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when the exercise isn't found or isn't owned", async () => {
      (prisma.exercise.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      const { req, res } = mockReqRes("DELETE");
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("deletes an owned exercise", async () => {
      (prisma.exercise.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      const { req, res } = mockReqRes("DELETE");
      await handler(req, res);

      expect(prisma.exercise.deleteMany).toHaveBeenCalledWith({ where: OWNERSHIP_WHERE });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("PATCH", () => {
    it("rejects unauthenticated requests", async () => {
      (getAuth as jest.Mock).mockReturnValue({ userId: null });
      const { req, res } = mockReqRes("PATCH", { exerciseId: "ex_1" }, VALID_PATCH_BODY);
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("rejects a missing exerciseId", async () => {
      const { req, res } = mockReqRes("PATCH", {}, VALID_PATCH_BODY);
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("rejects invalid input without touching the database", async () => {
      const { req, res } = mockReqRes("PATCH", { exerciseId: "ex_1" }, { exerciseName: "", sets: 0, reps: "", restSeconds: -5 });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.exercise.updateMany).not.toHaveBeenCalled();
    });

    it("returns 404 when the exercise isn't found or isn't owned, without re-fetching", async () => {
      (prisma.exercise.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      const { req, res } = mockReqRes("PATCH", { exerciseId: "ex_1" }, VALID_PATCH_BODY);
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.exercise.findUnique).not.toHaveBeenCalled();
    });

    it("updates an owned exercise and returns the refreshed row", async () => {
      (prisma.exercise.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.exercise.findUnique as jest.Mock).mockResolvedValue({ id: "ex_1", ...VALID_PATCH_BODY });

      const { req, res } = mockReqRes("PATCH", { exerciseId: "ex_1" }, VALID_PATCH_BODY);
      await handler(req, res);

      expect(prisma.exercise.updateMany).toHaveBeenCalledWith({
        where: OWNERSHIP_WHERE,
        data: VALID_PATCH_BODY,
      });
      expect(prisma.exercise.findUnique).toHaveBeenCalledWith({ where: { id: "ex_1" } });
      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.exercise.exerciseName).toBe("Goblet Squat");
    });
  });
});
