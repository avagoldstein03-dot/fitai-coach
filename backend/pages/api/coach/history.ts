import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET", "DELETE"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    if (req.method === "DELETE") {
      await prisma.chatMessage.deleteMany({
        where: { user: { clerkId: userId } },
      });
      return sendSuccess(res, null, "Chat history cleared");
    }

    const { limit = "50", offset = "0" } = req.query;

    const messages = await prisma.chatMessage.findMany({
      where: { user: { clerkId: userId } },
      orderBy: { createdAt: "asc" },
      take: Math.min(Number(limit), 100),
      skip: Number(offset),
    });

    const total = await prisma.chatMessage.count({
      where: { user: { clerkId: userId } },
    });

    sendSuccess(res, { messages, total, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    console.error("Coach history error:", error);
    sendError(res, "server_error", "Failed to fetch chat history", 500);
  }
}
