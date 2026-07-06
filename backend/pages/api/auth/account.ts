import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["DELETE", "GET"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  const { userId } = getAuth(req);
  if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

  // GET: export user data
  if (req.method === "GET") {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
          goal: true,
          bodyAssessments: true,
          meals: { include: { foods: true } },
          workoutSessions: true,
          chatMessages: { select: { role: true, content: true, createdAt: true } },
          progressPhotos: true,
        },
      });

      if (!user) return sendError(res, "user_not_found", "User not found", 404);

      sendSuccess(res, {
        exportedAt: new Date().toISOString(),
        profile: {
          name: user.name,
          email: user.email,
          age: user.age,
          sex: user.sex,
          height: user.height,
          weight: user.weight,
          dietPreferences: user.dietPreferences,
          foodAllergies: user.foodAllergies,
        },
        goal: user.goal,
        meals: user.meals,
        workouts: user.workoutSessions,
        assessments: user.bodyAssessments,
        chatHistory: user.chatMessages,
      }, "Data export ready");
    } catch (error) {
      console.error("Data export error:", error);
      sendError(res, "server_error", "Failed to export data", 500);
    }
    return;
  }

  // DELETE: delete account
  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    // Delete all user data in Prisma (cascade handles related records)
    await prisma.user.delete({ where: { clerkId: userId } });

    // Delete Clerk user
    await (await clerkClient()).users.deleteUser(userId);

    sendSuccess(res, null, "Account deleted successfully");
  } catch (error) {
    console.error("Account deletion error:", error);
    sendError(res, "server_error", "Failed to delete account", 500);
  }
}
