import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { categorizeIngredient, ShoppingListItem } from "@/lib/shopping-list";

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggle"), id: z.string().min(1), checked: z.boolean() }),
  z.object({
    action: z.literal("add"),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().positive().optional(),
    unit: z.string().trim().max(20).optional(),
  }),
  z.object({ action: z.literal("remove"), id: z.string().min(1) }),
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET", "PATCH"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const subscription = await getUserSubscription(req);
    if (!subscription.limits.groceryIntegration) {
      return sendError(res, "subscription_required", "Upgrade to access the shopping list", 403);
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const plan = await prisma.nutritionPlan.findUnique({ where: { userId: user.id } });
    const items = (plan?.shoppingList as { items?: ShoppingListItem[] } | null)?.items;

    if (req.method === "GET") {
      if (!plan || !items) {
        return sendError(res, "not_found", "No shopping list found. Generate a meal plan first.", 404);
      }
      return sendSuccess(res, { items });
    }

    // PATCH
    if (!plan || !items) {
      return sendError(res, "not_found", "No shopping list found. Generate a meal plan first.", 404);
    }

    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "validation_error", "Invalid request", 400);
    }

    let updatedItems: ShoppingListItem[];

    if (parsed.data.action === "toggle") {
      const { id, checked } = parsed.data;
      if (!items.some((item) => item.id === id)) {
        return sendError(res, "not_found", "Item not found", 404);
      }
      updatedItems = items.map((item) => (item.id === id ? { ...item, checked } : item));
    } else if (parsed.data.action === "add") {
      const { name, quantity, unit } = parsed.data;
      const newItem: ShoppingListItem = {
        id: crypto.randomUUID(),
        name,
        quantity: quantity ?? 1,
        unit: unit ?? "",
        category: categorizeIngredient(name),
        checked: false,
        isCustom: true,
      };
      updatedItems = [...items, newItem];
    } else {
      const { id } = parsed.data;
      updatedItems = items.filter((item) => item.id !== id);
    }

    const shoppingListData = {
      items: updatedItems,
      generatedAt: (plan.shoppingList as { generatedAt?: string } | null)?.generatedAt ?? new Date().toISOString(),
    } as unknown as Prisma.InputJsonValue;

    await prisma.nutritionPlan.update({
      where: { userId: user.id },
      data: { shoppingList: shoppingListData },
    });

    return sendSuccess(res, { items: updatedItems });
  } catch (error: any) {
    console.error("Shopping list error:", error);
    return sendError(res, "server_error", error?.message ?? "Failed to update shopping list", 500);
  }
}
