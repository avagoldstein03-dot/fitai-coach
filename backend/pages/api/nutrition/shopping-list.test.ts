import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import handler from "./shopping-list";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    nutritionPlan: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

const EXISTING_ITEMS = [
  { id: "eggs", name: "Eggs", quantity: 6, unit: "whole", category: "Dairy & Eggs", checked: false, isCustom: false },
  { id: "c-1", name: "Paper towels", quantity: 1, unit: "", category: "Other", checked: false, isCustom: true },
];

function mockReqRes(method: string, body: Record<string, unknown> = {}) {
  const req = { method, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("nutrition/shopping-list handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { groceryIntegration: true } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (prisma.nutritionPlan.findUnique as jest.Mock).mockResolvedValue({
      shoppingList: { items: EXISTING_ITEMS, generatedAt: "2026-01-01T00:00:00.000Z" },
    });
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

  it("rejects non-subscribed users for GET without touching the database", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { groceryIntegration: false } });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.nutritionPlan.findUnique).not.toHaveBeenCalled();
  });

  it("rejects non-subscribed users for PATCH", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { groceryIntegration: false } });
    const { req, res } = mockReqRes("PATCH", { action: "toggle", id: "eggs", checked: true });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 404 on GET when no plan exists yet", async () => {
    (prisma.nutritionPlan.findUnique as jest.Mock).mockResolvedValue(null);
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the items on GET", async () => {
    const { req, res } = mockReqRes("GET");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data.items).toEqual(EXISTING_ITEMS);
  });

  it("rejects a malformed PATCH body", async () => {
    const { req, res } = mockReqRes("PATCH", { action: "toggle" });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("toggles an item's checked state and persists it", async () => {
    const { req, res } = mockReqRes("PATCH", { action: "toggle", id: "eggs", checked: true });
    await handler(req, res);

    expect(prisma.nutritionPlan.update).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: { shoppingList: expect.objectContaining({ items: expect.any(Array) }) },
    });
    const updateCall = (prisma.nutritionPlan.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.shoppingList.items.find((i: any) => i.id === "eggs").checked).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 404 when toggling an unknown item id", async () => {
    const { req, res } = mockReqRes("PATCH", { action: "toggle", id: "nonexistent", checked: true });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.nutritionPlan.update).not.toHaveBeenCalled();
  });

  it("adds a custom item with an auto-derived category", async () => {
    const { req, res } = mockReqRes("PATCH", { action: "add", name: "Chicken breast", quantity: 2, unit: "lb" });
    await handler(req, res);

    const updateCall = (prisma.nutritionPlan.update as jest.Mock).mock.calls[0][0];
    const added = updateCall.data.shoppingList.items.find((i: any) => i.name === "Chicken breast");
    expect(added).toMatchObject({ category: "Proteins", isCustom: true, checked: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("removes an item by id, including an AI-generated (non-custom) item", async () => {
    const { req, res } = mockReqRes("PATCH", { action: "remove", id: "eggs" });
    await handler(req, res);

    const updateCall = (prisma.nutritionPlan.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.shoppingList.items.find((i: any) => i.id === "eggs")).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("scopes every database call to the authenticated user's own id", async () => {
    const { req, res } = mockReqRes("PATCH", { action: "toggle", id: "eggs", checked: true });
    await handler(req, res);

    expect(prisma.nutritionPlan.findUnique).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(prisma.nutritionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_1" } })
    );
  });
});
