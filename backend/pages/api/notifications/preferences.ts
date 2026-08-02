import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { parsePrefs } from "@/services/notifications";
import { z } from "zod";

const patchSchema = z.object({
  workout_reminders: z.boolean().optional(),
  meal_nudges:       z.boolean().optional(),
  progress_updates:  z.boolean().optional(),
  weekly_review:     z.boolean().optional(),
  social_nudges:     z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { notificationPrefs: true, pushToken: true },
  });
  if (!user) return sendError(res, "user_not_found", "User not found", 404);

  if (req.method === "GET") {
    return sendSuccess(res, {
      prefs:    parsePrefs(user.notificationPrefs),
      hasToken: !!user.pushToken,
    });
  }

  if (req.method === "PATCH") {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "validation_error", "Invalid preferences", 400);
    }

    const current = parsePrefs(user.notificationPrefs);
    const updated  = { ...current, ...parsed.data };

    await prisma.user.update({
      where: { clerkId: userId },
      data:  { notificationPrefs: updated },
    });

    return sendSuccess(res, { prefs: updated }, "Preferences updated");
  }

  return sendError(res, "method_not_allowed", "Method not allowed", 405);
}
