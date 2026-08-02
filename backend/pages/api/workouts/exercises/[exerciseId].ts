import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";

const ReplaceExerciseSchema = z.object({
  exerciseName: z.string().trim().min(1).max(200),
  sets: z.number().int().positive(),
  reps: z.string().trim().min(1).max(50),
  restSeconds: z.number().int().min(0),
  notes: z.string().trim().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["PATCH", "DELETE"].includes(req.method ?? "")) {
    return sendError(res, "method_not_allowed", "PATCH or DELETE required", 405);
  }

  const { userId } = getAuth(req);
  if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

  const { exerciseId } = req.query;
  if (!exerciseId || typeof exerciseId !== "string") {
    return sendError(res, "missing_exercise_id", "exerciseId is required", 400);
  }

  const ownershipWhere = {
    id: exerciseId,
    day: { week: { program: { user: { clerkId: userId } } } },
  };

  if (req.method === "DELETE") {
    try {
      const result = await prisma.exercise.deleteMany({ where: ownershipWhere });
      if (result.count === 0) return sendError(res, "not_found", "Exercise not found", 404);
      return sendSuccess(res, null, "Exercise deleted");
    } catch (error) {
      console.error("Delete exercise error:", error);
      return sendError(res, "server_error", "Failed to delete exercise", 500);
    }
  }

  try {
    const parsed = ReplaceExerciseSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        "validation_error",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        400
      );
    }

    const result = await prisma.exercise.updateMany({
      where: ownershipWhere,
      data: parsed.data,
    });
    if (result.count === 0) return sendError(res, "not_found", "Exercise not found", 404);

    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    return sendSuccess(res, { exercise }, "Exercise updated");
  } catch (error) {
    console.error("Replace exercise error:", error);
    return sendError(res, "server_error", "Failed to update exercise", 500);
  }
}
