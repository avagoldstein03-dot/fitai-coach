import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
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

  await prisma.user.update({
    where: { clerkId: userId },
    data:  { pushToken: token },
  });

  return sendSuccess(res, { registered: true }, "Push token registered");
}
