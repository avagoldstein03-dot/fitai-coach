import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import handler from "./history";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: jest.fn() },
    meal: { findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    foodItem: { deleteMany: jest.fn() },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  },
}));

const VALID_ITEMS = [
  { foodName: "Grilled Chicken", calories: 300, protein: 40, carbs: 0, fat: 10, fiber: 0 },
  { foodName: "Rice", calories: 200, protein: 4, carbs: 45, fat: 0, fiber: 1 },
];

function mockReqRes(method: string, query: Record<string, unknown> = {}, body: Record<string, unknown> = {}) {
  const req = { method, query, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("food/history handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (prisma.meal.findUnique as jest.Mock).mockResolvedValue({ id: "meal_1", userId: "user_1" });
    (prisma.$transaction as jest.Mock).mockImplementation((ops) => Promise.all(ops));
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = mockReqRes("PUT");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  describe("DELETE", () => {
    it("rejects unauthenticated requests", async () => {
      (getAuth as jest.Mock).mockReturnValue({ userId: null });
      const { req, res } = mockReqRes("DELETE", { id: "meal_1" });
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("rejects a missing id", async () => {
      const { req, res } = mockReqRes("DELETE", {});
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("rejects deleting a meal that belongs to another user", async () => {
      (prisma.meal.findUnique as jest.Mock).mockResolvedValue({ id: "meal_1", userId: "someone_else" });
      const { req, res } = mockReqRes("DELETE", { id: "meal_1" });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.meal.delete).not.toHaveBeenCalled();
    });

    it("deletes an owned meal", async () => {
      (prisma.meal.delete as jest.Mock).mockResolvedValue({});
      const { req, res } = mockReqRes("DELETE", { id: "meal_1" });
      await handler(req, res);

      expect(prisma.meal.delete).toHaveBeenCalledWith({ where: { id: "meal_1" } });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("PATCH", () => {
    it("rejects unauthenticated requests", async () => {
      (getAuth as jest.Mock).mockReturnValue({ userId: null });
      const { req, res } = mockReqRes("PATCH", { id: "meal_1" }, { items: VALID_ITEMS });
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("rejects a missing id", async () => {
      const { req, res } = mockReqRes("PATCH", {}, { items: VALID_ITEMS });
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("rejects updating a meal that belongs to another user", async () => {
      (prisma.meal.findUnique as jest.Mock).mockResolvedValue({ id: "meal_1", userId: "someone_else" });
      const { req, res } = mockReqRes("PATCH", { id: "meal_1" }, { items: VALID_ITEMS });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects an empty items array", async () => {
      const { req, res } = mockReqRes("PATCH", { id: "meal_1" }, { items: [] });
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("recomputes totals and replaces food items", async () => {
      (prisma.meal.update as jest.Mock).mockResolvedValue({
        id: "meal_1",
        mealType: "lunch",
        totalCalories: 500,
        totalProtein: 44,
        totalCarbs: 45,
        totalFat: 10,
        foods: VALID_ITEMS,
      });

      const { req, res } = mockReqRes("PATCH", { id: "meal_1" }, { mealType: "lunch", items: VALID_ITEMS });
      await handler(req, res);

      expect(prisma.foodItem.deleteMany).toHaveBeenCalledWith({ where: { mealId: "meal_1" } });
      expect(prisma.meal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "meal_1" },
          data: expect.objectContaining({
            mealType: "lunch",
            totalCalories: 500,
            totalProtein: 44,
            totalCarbs: 45,
            totalFat: 10,
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.meal.totalCalories).toBe(500);
    });
  });
});
