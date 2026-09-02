import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

const applyCodeSchema = z.object({
  code: z.string().trim().min(1).max(12),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const parsed = applyCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "validation_error", "A referral code is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const existingReferral = await prisma.affiliateReferral.findUnique({
      where: { userId: user.id },
    });
    if (existingReferral) {
      return sendError(
        res,
        "already_attributed",
        "You've already been attributed to a referral code",
        409
      );
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { code: parsed.data.code.toUpperCase() },
    });
    if (!affiliate || !affiliate.active) {
      return sendError(res, "code_not_found", "That referral code isn't valid", 404);
    }

    await prisma.affiliateReferral.create({
      data: { affiliateId: affiliate.id, userId: user.id },
    });

    return sendSuccess(res, { applied: true }, "Referral code applied");
  } catch (error) {
    console.error("Affiliate apply-code error:", error);
    sendError(res, "server_error", "Failed to apply referral code", 500);
  }
}
