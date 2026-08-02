import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";

const UpdateSupplementSchema = z.object({
  dosage: z.string().trim().min(1).max(100),
  frequency: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["PATCH", "DELETE"].includes(req.method ?? "")) {
    return sendError(res, "method_not_allowed", "PATCH or DELETE required", 405);
  }

  const { userId } = getAuth(req);
  if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return sendError(res, "missing_id", "Supplement id is required", 400);
  }

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    if (req.method === "DELETE") {
      const result = await prisma.userSupplement.deleteMany({ where: { id, userId: user.id } });
      if (result.count === 0) return sendError(res, "not_found", "Supplement not found", 404);
      return sendSuccess(res, null, "Removed from your stack");
    }

    const parsed = UpdateSupplementSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        "validation_error",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        400
      );
    }

    const { dosage, frequency, reason } = parsed.data;
    const result = await prisma.userSupplement.updateMany({
      where: { id, userId: user.id },
      data: { dosage, frequency, reason: reason ?? "" },
    });
    if (result.count === 0) return sendError(res, "not_found", "Supplement not found", 404);

    const updated = await prisma.userSupplement.findUnique({
      where: { id },
      include: { supplement: true },
    });

    return sendSuccess(res, {
      supplement: {
        id: updated!.id,
        name: updated!.supplement.name,
        category: updated!.supplement.category,
        dosage: updated!.dosage,
        frequency: updated!.frequency,
        reason: updated!.reason,
      },
    }, "Supplement updated");
  } catch (error) {
    console.error("Supplement stack update error:", error);
    return sendError(res, "server_error", "Failed to update your supplement stack", 500);
  }
}
