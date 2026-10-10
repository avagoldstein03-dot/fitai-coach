import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { z } from "zod";

import { PRIMARY_GOALS } from "@/lib/profile-options";
import { computeGoalProgress, shouldShowWeightTarget } from "@/lib/goal-progress";

// Onboarding step 2 collects a target weight and a timeline alongside the goal,
// and neither could ever be changed again — this editor only accepted
// primaryGoal, so a target set on day one was permanent.
//
// Both are nullable rather than merely optional, so a target someone has passed
// or no longer wants can be cleared instead of sitting there forever.
const patchSchema = z
  .object({
    primaryGoal: z.enum(PRIMARY_GOALS).optional(),
    targetWeight: z.number().min(20).max(500).nullable().optional(), // kg
    timeline: z.number().int().min(1).max(260).nullable().optional(), // weeks
  })
  // An empty body would otherwise upsert a row with every field undefined,
  // which on create means a goal with no primaryGoal at all.
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

// Dedicated post-onboarding goal editor. Deliberately doesn't reuse
// /api/onboarding/step2 — that endpoint also resets onboardingStep, which is
// the wrong side effect for someone who already completed onboarding.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET", "PATCH"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, weight: true, medicalConditions: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    if (req.method === "PATCH") {
      const validation = patchSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, "validation_error", "Invalid request body", 400);
      }

      const { primaryGoal, targetWeight, timeline } = validation.data;

      // Snapshot where they are starting from whenever a target is set or
      // changed, because progress needs a start point and weight history only
      // exists for people who connected Apple Health. Clearing the target
      // clears the snapshot too, so a later target does not measure from a
      // weight from months ago.
      let startWeight: number | null | undefined;
      let targetSetAt: Date | null | undefined;
      if (targetWeight !== undefined) {
        startWeight = targetWeight === null ? null : user.weight;
        targetSetAt = targetWeight === null ? null : new Date();
      }

      const goal = await prisma.goal.upsert({
        where: { userId: user.id },
        // Prisma leaves `undefined` fields alone and writes `null` as null, so
        // a partial patch touches only what was sent and an explicit null
        // clears a target.
        update: { primaryGoal, targetWeight, timeline, startWeight, targetSetAt },
        // primaryGoal is required on the row, so a create that only carries a
        // target weight still needs one. Anyone reaching this without a goal
        // row has none set, and general_health is what the rest of the app
        // already falls back to for exactly that case.
        create: {
          userId: user.id,
          primaryGoal: primaryGoal ?? "general_health",
          targetWeight: targetWeight ?? null,
          timeline: timeline ?? null,
          startWeight: startWeight ?? null,
          targetSetAt: targetSetAt ?? null,
        },
      });

      return sendSuccess(res, { goal }, "Goal updated successfully");
    }

    const goal = await prisma.goal.findUnique({ where: { userId: user.id } });

    // Whether a weight target is appropriate to show at all is a health
    // question, not a UI one — see shouldShowWeightTarget. Withheld server-side
    // so the client cannot show it by forgetting to check.
    const showWeightTarget = shouldShowWeightTarget(user.medicalConditions);
    const progress = showWeightTarget
      ? computeGoalProgress({
          startWeight: goal?.startWeight,
          currentWeight: user.weight,
          targetWeight: goal?.targetWeight,
          timelineWeeks: goal?.timeline,
          targetSetAt: goal?.targetSetAt,
        })
      : null;

    return sendSuccess(res, { goal, progress, showWeightTarget });
  } catch (error) {
    console.error("Goal error:", error);
    sendError(res, "server_error", "Failed to update goal", 500);
  }
}
