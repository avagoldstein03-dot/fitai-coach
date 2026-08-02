import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { lookupProduct } from "@/services/openfoodfacts-provider";
import { computeProductScore, SCORING_VERSION } from "@/lib/ingredient-score";

const RequestSchema = z.object({
  barcode: z.string().trim().regex(/^\d{6,14}$/, "Invalid barcode"),
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
