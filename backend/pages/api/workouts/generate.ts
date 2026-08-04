import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { AIProviderRegistry } from "@/services/ai-registry";
import { getUserSubscription } from "@/lib/subscription-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const subscription = await getUserSubscription(req);
    if (!subscription.limits.unlimitedWorkouts) {
      const existingPrograms = await prisma.workoutProgram.count({
        where: { user: { clerkId: userId }, isActive: true },
      });
      if (existingPrograms >= 1) {
        return sendError(
          res,
          "subscription_required",
          "Upgrade to Premium to generate unlimited workout programs",
          403
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { goal: true },
    });

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const {
      equipment = ["bodyweight"],
      daysPerWeek = 4,
      durationWeeks = 4,
      bodyGoalFocus,
      specificFocus,
    } = req.body;

    // Persist the goal-focus answers so they don't need to be re-asked next time
    if (bodyGoalFocus || specificFocus) {
      await prisma.goal.upsert({
        where: { userId: user.id },
        update: {
          ...(bodyGoalFocus ? { bodyGoalFocus } : {}),
          ...(specificFocus !== undefined ? { specificFocus } : {}),
        },
        create: {
          userId: user.id,
          primaryGoal: user.goal?.primaryGoal || "general_health",
          bodyGoalFocus,
          specificFocus,
        },
      });
    }

    const latestAssessment = await prisma.bodyAssessment.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { summary: true },
    });

    const aiProvider = AIProviderRegistry.getProviderForTask("workout_generation");

    const workoutPlan = await aiProvider.generateWorkout({
      goal: user.goal?.primaryGoal || "general_health",
      experience: user.fitnessExperience || "beginner",
      equipment,
      durationWeeks,
      daysPerWeek,
      sex: user.sex ?? undefined,
      bodyGoalFocus: bodyGoalFocus ?? user.goal?.bodyGoalFocus ?? undefined,
      specificFocus: specificFocus ?? user.goal?.specificFocus ?? undefined,
      assessmentSummary: latestAssessment?.summary ?? undefined,
    });

    // Deactivate any current active program
    await prisma.workoutProgram.updateMany({
      where: { user: { clerkId: userId }, isActive: true },
      data: { isActive: false },
    });

    // Store the new program (structured storage of AI output)
    const program = await prisma.workoutProgram.create({
      data: {
        user: { connect: { clerkId: userId } },
        name: `${durationWeeks}-Week ${user.goal?.primaryGoal || "Fitness"} Program`,
        duration: durationWeeks,
        goal: user.goal?.primaryGoal || "general_health",
        equipmentAvailable: equipment,
        coachNote: workoutPlan.coachNote,
        isActive: true,
        startDate: new Date(),
        weeks: {
          create: workoutPlan.weeks.map((week) => ({
            weekNumber: week.weekNumber,
            progressionStrategy: week.progressionStrategy,
            days: {
              create: week.days.map((day) => ({
                dayOfWeek: day.dayOfWeek,
                exercises: {
                  create: day.exercises.map((ex) => ({
                    exerciseName: ex.exerciseName,
                    sets: ex.sets,
                    reps: ex.reps,
                    restSeconds: ex.restSeconds,
                    notes: ex.notes,
                  })),
                },
              })),
            },
          })),
        },
      },
      include: { weeks: { include: { days: { include: { exercises: true } } } } },
    });

    // Log analytics event
    await prisma.analyticsEvent.create({
      data: {
        user: { connect: { clerkId: userId } },
        eventName: "workout_program_generated",
        eventProperties: {
          goal: user.goal?.primaryGoal,
          durationWeeks,
          daysPerWeek,
          experience: user.fitnessExperience,
        },
      },
    });

    sendSuccess(
      res,
      { programId: program.id, program },
      "Workout program generated successfully",
      201
    );
  } catch (error: any) {
    console.error("Workout generation error:", error);
    sendError(res, "server_error", error?.message ?? "Failed to generate workout program", 500);
  }
}
