import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { checkAndAwardBadges } from "@/services/badges";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const {
      exerciseName,
      plannedSets,
      plannedReps,
      completedSets,
      completedReps,
      weight,
      durationMinutes,
      notes,
    } = req.body;

    if (!exerciseName || plannedSets === undefined || !plannedReps) {
      return sendError(res, "validation_error", "exerciseName, plannedSets, and plannedReps are required", 400);
    }

    const session = await prisma.workoutSession.create({
      data: {
        user: { connect: { clerkId: userId } },
        exerciseName,
        plannedSets: Number(plannedSets),
        plannedReps: String(plannedReps),
        completedSets: Number(completedSets ?? plannedSets),
        completedReps: String(completedReps ?? plannedReps),
        weight: weight ? Number(weight) : null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        notes: notes || null,
        isCompleted: true,
      },
    });

    await prisma.analyticsEvent.create({
      data: {
        user: { connect: { clerkId: userId } },
        eventName: "workout_session_logged",
        eventProperties: { exerciseName, completedSets, completedReps, weight },
      },
    });

    await checkAndAwardBadges(session.userId).catch((err) => console.error("Badge check failed:", err));

    sendSuccess(res, { session }, "Workout session logged", 201);
  } catch (error) {
    console.error("Log session error:", error);
    sendError(res, "server_error", "Failed to log workout session", 500);
  }
}
