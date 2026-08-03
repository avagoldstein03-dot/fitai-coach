import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { getVideoForExercise } from "@/lib/exercise-video-catalog";

const AddExerciseSchema = z.object({
  dayId: z.string().min(1),
  exerciseName: z.string().trim().min(1).max(200),
  sets: z.number().int().positive(),
  reps: z.string().trim().min(1).max(50),
  restSeconds: z.number().int().min(0),
  notes: z.string().trim().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const parsed = AddExerciseSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        "validation_error",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        400
      );
    }

    const { dayId, ...exerciseData } = parsed.data;

    const day = await prisma.workoutDay.findFirst({
      where: { id: dayId, week: { program: { user: { clerkId: userId } } } },
      select: { id: true },
    });
    if (!day) return sendError(res, "not_found", "Workout day not found", 404);

    const exercise = await prisma.exercise.create({
      data: { dayId, ...exerciseData, ...getVideoForExercise(exerciseData.exerciseName) },
    });

    return sendSuccess(res, { exercise }, "Exercise added", 201);
  } catch (error) {
    console.error("Add exercise error:", error);
    return sendError(res, "server_error", "Failed to add exercise", 500);
  }
}
