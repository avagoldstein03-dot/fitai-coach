import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import stripe from "@/services/stripe-service";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

const ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS || "").split(",").filter(Boolean);

const payoutSchema = z.object({
  code: z.string().trim().min(1).max(12),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);
    if (!ADMIN_CLERK_IDS.includes(userId)) {
      return sendError(res, "forbidden", "Admin access required", 403);
    }

    const parsed = payoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "validation_error", "An affiliate code is required", 400);
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { code: parsed.data.code.toUpperCase() },
      include: { referrals: { include: { commissionEntries: true } } },
    });
    if (!affiliate) return sendError(res, "affiliate_not_found", "No affiliate found with that code", 404);

    if (!affiliate.stripeOnboardingComplete || !affiliate.stripeAccountId) {
      return sendError(
        res,
        "onboarding_incomplete",
        "This affiliate hasn't finished Stripe onboarding yet — send them an onboarding link first",
        400
      );
    }

    const allPending = affiliate.referrals
      .flatMap((r) => r.commissionEntries)
      .filter((e) => e.status === "pending");

    const payable = allPending.filter((e) => e.currency.toLowerCase() === "usd");
    const skippedNonUsd = allPending.length - payable.length;

    if (payable.length === 0) {
      return sendError(
        res,
        "nothing_pending",
        skippedNonUsd > 0
          ? "No payable (USD) pending commission — non-USD entries exist but aren't handled yet"
          : "No pending commission for this affiliate",
        400
      );
    }

    const totalUsd = payable.reduce((sum, e) => sum + e.commissionAmount, 0);

    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: Math.round(totalUsd * 100),
        currency: "usd",
        destination: affiliate.stripeAccountId,
      });
    } catch (err: any) {
      console.error("Stripe transfer failed:", err);
      return sendError(
        res,
        "transfer_failed",
        err?.message ?? "Stripe transfer failed — check the platform account's available balance",
        502
      );
    }

    const paidAt = new Date();
    await prisma.commissionEntry.updateMany({
      where: { id: { in: payable.map((e) => e.id) } },
      data: { status: "paid", paidAt, stripeTransferId: transfer.id },
    });

    sendSuccess(res, {
      transferId: transfer.id,
      amountPaidUsd: totalUsd,
      entriesPaid: payable.length,
      skippedNonUsd,
    });
  } catch (error) {
    console.error("Affiliate payout error:", error);
    sendError(res, "server_error", "Failed to process payout", 500);
  }
}
