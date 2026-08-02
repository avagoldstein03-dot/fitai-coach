import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { SUPPLEMENT_DATABASE } from "@/lib/supplement-database";

const AddSupplementSchema = z.object({
  name: z.string().trim().min(1).max(150),
  dosage: z.string().trim().min(1).max(100),
  frequency: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET", "POST"])) {
    return sendError(res, "method_not_allowed", "GET or POST required", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    if (req.method === "GET") {
      const stack = await prisma.userSupplement.findMany({
        where: { userId: user.id },
        include: { supplement: true },
        orderBy: { createdAt: "desc" },
      });

      return sendSuccess(res, {
        stack: stack.map((item) => ({
          id: item.id,
          name: item.supplement.name,
          category: item.supplement.category,
          dosage: item.dosage,
          frequency: item.frequency,
          reason: item.reason,
          createdAt: item.createdAt,
        })),
      });
    }

    // POST — add a supplement to the user's stack
    const subscription = await getUserSubscription(req);
    if (!subscription.limits.supplements) {
      return sendError(res, "subscription_required", "Upgrade to Premium to build your supplement stack", 403);
    }

    const parsed = AddSupplementSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        "validation_error",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        400
      );
    }

    const { name, dosage, frequency, reason } = parsed.data;
    const knownRule = SUPPLEMENT_DATABASE.find((s) => s.name.toLowerCase() === name.toLowerCase());

    let supplement = await prisma.supplement.findFirst({ where: { name } });
    if (!supplement) {
      supplement = await prisma.supplement.create({
        data: {
          name,
          category: knownRule?.category ?? "custom",
          benefits: knownRule?.benefits ?? [],
          dosageMin: knownRule?.dosageMin ?? "",
          dosageMax: knownRule?.dosageMax ?? "",
          unit: knownRule?.unit ?? "",
        },
      });
    }

    const userSupplement = await prisma.userSupplement.create({
      data: {
        userId: user.id,
        supplementId: supplement.id,
        dosage,
        frequency,
        reason: reason ?? "",
      },
    });

    return sendSuccess(
      res,
      {
        supplement: {
          id: userSupplement.id,
          name: supplement.name,
          category: supplement.category,
          dosage: userSupplement.dosage,
          frequency: userSupplement.frequency,
          reason: userSupplement.reason,
          createdAt: userSupplement.createdAt,
        },
      },
      "Added to your stack",
      201
    );
  } catch (error) {
    console.error("Supplement stack error:", error);
    return sendError(res, "server_error", "Failed to update your supplement stack", 500);
  }
}
