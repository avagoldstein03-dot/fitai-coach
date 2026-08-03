import type { NextApiRequest, NextApiResponse } from "next";
import { sendSuccess, sendError } from "@/lib/api-utils";
import {
  broadcastWorkoutReminders,
  broadcastMealNudges,
  broadcastProgressUpdates,
  broadcastWeeklyReviewReady,
} from "@/services/notifications";

// Call this endpoint from a cron job (Vercel Cron, GitHub Actions, etc.)
// Protect with a shared secret so it can't be triggered publicly.
//
// Vercel Cron example (vercel.json):
//   { "crons": [
//     { "path": "/api/notifications/cron?type=workout", "schedule": "0 8 * * *" },
//     { "path": "/api/notifications/cron?type=meal",    "schedule": "0 12,18 * * *" }
//   ]}
//
// The Vercel Hobby plan caps a project at 2 cron jobs, and both slots above
// are already spoken for. Rather than add a 3rd entry, the weekly progress-
// update and weekly-review notifications piggyback onto the existing daily
// `workout` cron: on Sundays only, the `type=workout` branch below also fires
// the two weekly broadcasts. No vercel.json changes needed.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  // Verify cron secret
  const secret = req.headers["x-cron-secret"] ?? req.query.secret;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && secret !== cronSecret) {
    return sendError(res, "forbidden", "Forbidden", 403);
  }

  const type = req.query.type as string;

  if (type === "workout") {
    const result = await broadcastWorkoutReminders();

    // Sunday piggyback — see the vercel.json note above.
    if (new Date().getUTCDay() === 0) {
      const [progressUpdates, weeklyReview] = await Promise.all([
        broadcastProgressUpdates(),
        broadcastWeeklyReviewReady(),
      ]);
      return sendSuccess(
        res,
        { workoutReminders: result, progressUpdates, weeklyReview },
        "Workout reminders + Sunday weekly notifications sent"
      );
    }

    return sendSuccess(res, result, "Workout reminders sent");
  }

  if (type === "meal") {
    const result = await broadcastMealNudges();
    return sendSuccess(res, result, "Meal nudges sent");
  }

  // Default: run all
  const [workouts, meals] = await Promise.all([
    broadcastWorkoutReminders(),
    broadcastMealNudges(),
  ]);

  return sendSuccess(res, { workouts, meals }, "All notifications sent");
}
