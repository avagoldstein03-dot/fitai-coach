import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

const connectSchema = z.object({
  code: z.string().trim().min(1).max(12),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "validation_error", "A connect code is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const friend = await prisma.user.findUnique({
      where: { friendCode: parsed.data.code.toUpperCase() },
      select: { id: true, name: true },
    });
    if (!friend) {
      return sendError(res, "code_not_found", "No account found with that code", 404);
    }
    if (friend.id === user.id) {
      return sendError(res, "self_connect", "You can't connect with yourself", 400);
    }

    const existing = await prisma.friendConnection.findUnique({
      where: { userId_friendId: { userId: user.id, friendId: friend.id } },
    });

    if (!existing) {
      await prisma.$transaction([
        prisma.friendConnection.create({ data: { userId: user.id, friendId: friend.id } }),
        prisma.friendConnection.create({ data: { userId: friend.id, friendId: user.id } }),
      ]);
    }

    return sendSuccess(res, { friend: { id: friend.id, name: friend.name } }, "Connected");
  } catch (error) {
    console.error("Friend connect error:", error);
    sendError(res, "server_error", "Failed to connect", 500);
  }
}
