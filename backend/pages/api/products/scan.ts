import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { lookupProduct } from "@/services/openfoodfacts-provider";
import { computeProductScore, SCORING_VERSION } from "@/lib/ingredient-score";
import { lookupPLU } from "@/lib/plu-codes";

const RequestSchema = z.object({
  barcode: z.string().trim().regex(/^\d{4,14}$/, "Invalid barcode"),
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
      return sendError(res, "invalid_input", "A valid barcode is required", 400);
    }
    const { barcode } = parsed.data;

    // 4-5 digit codes are PLU (loose produce) codes, not EAN/UPC barcodes —
    // they can't match anything in the ProductScan cache or Open Food
    // Facts (which is keyed by manufacturer GTIN), so resolve them against
    // our own small produce table instead of hitting either.
    if (barcode.length <= 5) {
      const produce = lookupPLU(barcode);
      if (!produce) {
        return sendSuccess(res, { status: "not_found", barcode });
      }
      return sendSuccess(res, {
        status: "found",
        cacheHit: false,
        product: {
          productName: produce.name,
          brand: null,
          imageUrl: null,
          ingredientsText: null,
          additivesTags: [],
          novaGroup: 1,
          nutriscoreGrade: null,
          score: 95,
          grade: "great",
          flaggedIngredients: [],
          caloriesPer100g: produce.caloriesPer100g,
          proteinPer100g: produce.proteinPer100g,
          carbsPer100g: produce.carbsPer100g,
          fatPer100g: produce.fatPer100g,
          servingSizeGrams: null,
          isUserSubmitted: false,
        },
      });
    }

    const cached = await prisma.productScan.findUnique({ where: { barcode } });

    if (cached && cached.scoringVersion === SCORING_VERSION) {
      return sendSuccess(res, { status: "found", cacheHit: true, product: cached });
    }

    if (cached) {
      const { score, grade, flaggedIngredients } = computeProductScore({
        novaGroup: cached.novaGroup,
        nutriscoreGrade: cached.nutriscoreGrade,
        additivesTags: cached.additivesTags,
      });
      const updated = await prisma.productScan.update({
        where: { barcode },
        data: {
          score,
          grade,
          flaggedIngredients: flaggedIngredients as any,
          scoringVersion: SCORING_VERSION,
        },
      });
      return sendSuccess(res, { status: "found", cacheHit: true, product: updated });
    }

    let offProduct;
    try {
      offProduct = await lookupProduct(barcode);
    } catch {
      return sendError(
        res,
        "upstream_unavailable",
        "Product database temporarily unavailable, try again shortly",
        502
      );
    }

    if (!offProduct) {
      return sendSuccess(res, { status: "not_found", barcode });
    }

    const { score, grade, flaggedIngredients } = computeProductScore({
      novaGroup: offProduct.novaGroup,
      nutriscoreGrade: offProduct.nutriscoreGrade,
      additivesTags: offProduct.additivesTags,
    });

    const saved = await prisma.productScan.upsert({
      where: { barcode },
      create: {
        barcode,
        ...offProduct,
        score,
        grade,
        flaggedIngredients: flaggedIngredients as any,
        scoringVersion: SCORING_VERSION,
      },
      update: {
        ...offProduct,
        score,
        grade,
        flaggedIngredients: flaggedIngredients as any,
        scoringVersion: SCORING_VERSION,
        lastFetchedAt: new Date(),
      },
    });

    return sendSuccess(res, { status: "found", cacheHit: false, product: saved });
  } catch (error) {
    console.error("Product scan error:", error);
    return sendError(res, "product_scan_failed", "Product scan failed", 500);
  }
}
