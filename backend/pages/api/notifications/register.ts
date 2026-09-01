import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { notifyOnboardingWelcome } from "@/services/notifications";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(10),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "DELETE") {
    // Unregister — clear the push token
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    await prisma.user.updateMany({
      where: { clerkId: userId },
      data:  { pushToken: null },
    });

    return sendSuccess(res, null, "Push token removed");
  }

  if (req.method !== "POST") {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  const { userId } = getAuth(req);
  if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "validation_error", "Valid push token required", 400);
  }

  const { token } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { pushToken: true },
  });

  const user = await prisma.user.update({
    where: { clerkId: userId },
    data:  { pushToken: token },
  });

  // Fire the D0 welcome only the first time a token is registered for this
  // user — re-registration on reinstall/relaunch shouldn't re-send it.
  if (!existing?.pushToken) {
    notifyOnboardingWelcome(user.id).catch((err) => console.error("D0 welcome push failed:", err));
  }

  return sendSuccess(res, { registered: true }, "Push token registered");
}
