import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { z } from "zod";

const logSchema = z.object({
  weight: z.number().min(20).max(500),
  note:   z.string().max(200).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, weight: true },
  });
  if (!user) return sendError(res, "user_not_found", "User not found", 404);

  // GET — return weight history (last 90 days by default)
  if (req.method === "GET") {
    const days   = Math.min(Number(req.query.days ?? 90), 365);
    const since  = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.weightLog.findMany({
      where: { userId: user.id, loggedAt: { gte: since } },
      orderBy: { loggedAt: "asc" },
    });

    const current = user.weight;
    const change  = logs.length >= 2
      ? logs[logs.length - 1].weight - logs[0].weight
      : 0;

    return sendSuccess(res, { logs, current, change, days });
  }

  // POST — log a new weight entry
  if (req.method === "POST") {
    const parsed = logSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "validation_error", "Invalid weight value", 400);
    }

    const { weight, note } = parsed.data;

    const [log] = await Promise.all([
      prisma.weightLog.create({
        data: { userId: user.id, weight, note: note ?? null },
      }),
      // Keep User.weight in sync with the latest logged weight
      prisma.user.update({
        where: { id: user.id },
        data:  { weight },
      }),
    ]);

    return sendSuccess(res, { log }, "Weight logged", 201);
  }

  // DELETE — remove a single log entry
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return sendError(res, "missing_id", "Log id required", 400);
    }
    const entry = await prisma.weightLog.findUnique({ where: { id } });
    if (!entry || entry.userId !== user.id) {
      return sendError(res, "not_found", "Entry not found", 404);
    }
    await prisma.weightLog.delete({ where: { id } });
    return sendSuccess(res, null, "Entry deleted");
  }

  return sendError(res, "method_not_allowed", "Method not allowed", 405);
}
