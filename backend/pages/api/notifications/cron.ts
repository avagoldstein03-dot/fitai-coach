import type { NextApiRequest, NextApiResponse } from "next";
import { sendSuccess, sendError } from "@/lib/api-utils";
import {
  broadcastWorkoutReminders,
  broadcastMealNudges,
} from "@/services/notifications";

// Call this endpoint from a cron job (Vercel Cron, GitHub Actions, etc.)
// Protect with a shared secret so it can't be triggered publicly.
//
// Vercel Cron example (vercel.json):
//   { "crons": [
//     { "path": "/api/notifications/cron?type=workout", "schedule": "0 8 * * *" },
//     { "path": "/api/notifications/cron?type=meal",    "schedule": "0 12,18 * * *" }
//   ]}

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
