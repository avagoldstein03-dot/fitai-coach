import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { REFERRAL_DISCOUNT_PERCENT, REFERRAL_OFFER_IDENTIFIER } from "@/lib/affiliate-offer";

/**
 * Whether this user came in through an influencer's code, and what they get.
 *
 * The Pricing screen needs this: without it a user enters a code, sees full
 * price with no acknowledgement, and reasonably concludes the code did nothing.
 *
 * Returns the affiliate's name but never their email, commission rate or
 * earnings — a subscriber has no business seeing what their influencer is paid.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        subscription: { select: { plan: true, status: true } },
        affiliateReferral: {
          select: { createdAt: true, affiliate: { select: { name: true, code: true, active: true } } },
        },
      },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const referral = user.affiliateReferral;
    // An inactive affiliate keeps their attribution — commission already earned
    // is still owed — but their code stops unlocking the offer for new signups.
    const eligible = !!referral?.affiliate.active;

    return sendSuccess(res, {
      referred: !!referral,
      referredBy: referral?.affiliate.name ?? null,
      code: referral?.affiliate.code ?? null,
      appliedAt: referral?.createdAt ?? null,
      offer: eligible
        ? {
            discountPercent: REFERRAL_DISCOUNT_PERCENT,
            identifier: REFERRAL_OFFER_IDENTIFIER,
          }
        : null,
    });
  } catch (error) {
    console.error("Affiliate status error:", error);
    sendError(res, "server_error", "Failed to load referral status", 500);
  }
}
