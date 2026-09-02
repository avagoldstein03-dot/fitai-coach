import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

const ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS || "").split(",").filter(Boolean);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    if (!ADMIN_CLERK_IDS.includes(userId)) {
      return sendError(res, "forbidden", "Admin access required", 403);
    }

    const affiliates = await prisma.affiliate.findMany({
      include: {
        referrals: {
          include: { commissionEntries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const summary = affiliates.map((affiliate) => {
      const entries = affiliate.referrals.flatMap((r) => r.commissionEntries);
      const pendingEntries = entries.filter((e) => e.status === "pending");
      return {
        code: affiliate.code,
        name: affiliate.name,
        commissionRate: affiliate.commissionRate,
        active: affiliate.active,
        referredUserCount: affiliate.referrals.length,
        totalPendingCommission: pendingEntries.reduce((sum, e) => sum + e.commissionAmount, 0),
        entries: entries.map((e) => ({
          eventType: e.eventType,
          grossAmount: e.grossAmount,
          currency: e.currency,
          commissionAmount: e.commissionAmount,
          status: e.status,
          createdAt: e.createdAt,
        })),
      };
    });

    sendSuccess(res, { affiliates: summary });
  } catch (error) {
    console.error("Admin affiliates error:", error);
    sendError(res, "server_error", "Failed to load affiliate summary", 500);
  }
}
