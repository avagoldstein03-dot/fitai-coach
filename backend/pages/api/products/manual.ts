import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { computeProductPersonalization, fetchPersonalizationContext } from "@/lib/product-personalization";

const RequestSchema = z.object({
  barcode: z.string().trim().regex(/^\d{4,14}$/, "Invalid barcode"),
  productName: z.string().trim().min(1).max(100),
  brand: z.string().trim().max(100).optional(),
  caloriesPer100g: z.number().min(0).max(1000).optional(),
  proteinPer100g: z.number().min(0).max(200).optional(),
  carbsPer100g: z.number().min(0).max(200).optional(),
  fatPer100g: z.number().min(0).max(200).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return sendError(res, "invalid_method", "POST required", 405);
  }

  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return sendError(res, "unauthorized", "Authentication required", 401);
    }

    const allowed = await checkRateLimit("product-scan", auth.userId, 30, "1 h");
    if (!allowed) {
      return sendError(res, "rate_limited", "Too many requests, please slow down", 429);
    }

    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "validation_error", "A valid product name and barcode are required", 400);
    }
    const { barcode, productName, brand, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g } = parsed.data;

    const user = await prisma.user.findUnique({ where: { clerkId: auth.userId }, select: { id: true } });
    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    // Don't let a manual submission clobber an existing row — whether it
    // came from Open Food Facts or an earlier user submission, that data
    // is at least as good as a fresh one-off entry.
    const existing = await prisma.productScan.findUnique({ where: { barcode } });
    if (existing) {
      const context = await fetchPersonalizationContext(user.id);
      const personalization = computeProductPersonalization({ ...context, product: existing });
      return sendSuccess(res, { status: "found", cacheHit: true, product: existing, personalization });
    }

    const created = await prisma.productScan.create({
      data: {
        barcode,
        productName,
        brand: brand || null,
        caloriesPer100g: caloriesPer100g ?? null,
        proteinPer100g: proteinPer100g ?? null,
        carbsPer100g: carbsPer100g ?? null,
        fatPer100g: fatPer100g ?? null,
        score: 0,
        grade: "good",
        flaggedIngredients: [],
        isUserSubmitted: true,
      },
    });

    const context = await fetchPersonalizationContext(user.id);
    const personalization = computeProductPersonalization({ ...context, product: created });
    return sendSuccess(res, { status: "found", cacheHit: false, product: created, personalization });
  } catch (error: any) {
    console.error("Manual product submission error:", error);
    return sendError(res, "server_error", error?.message ?? "Failed to save product", 500);
  }
}
