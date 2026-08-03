import { sendPushNotification, sendBulkNotifications } from "./firebase";
import prisma from "@/lib/prisma";
import { detectWorkoutPlateaus, diffBodyComposition, buildTrendsSummary } from "@/lib/trends";
import { resolveTier, TIER_LIMITS } from "@/lib/subscription-middleware";

export type NotificationPref =
  | "workout_reminders"
  | "meal_nudges"
  | "progress_updates"
  | "weekly_review"
  | "social_nudges";

interface NotifPrefs {
  workout_reminders: boolean;
  meal_nudges: boolean;
  progress_updates: boolean;
  weekly_review: boolean;
  social_nudges: boolean;
}

function defaultPrefs(): NotifPrefs {
  return {
    workout_reminders: true,
    meal_nudges:       true,
    progress_updates:  true,
    weekly_review:     true,
    social_nudges:     true,
  };
}

export function parsePrefs(raw: unknown): NotifPrefs {
  if (!raw || typeof raw !== "object") return defaultPrefs();
  const p = raw as Record<string, unknown>;
  return {
    workout_reminders: p.workout_reminders !== false,
    meal_nudges:       p.meal_nudges       !== false,
    progress_updates:  p.progress_updates  !== false,
    weekly_review:     p.weekly_review     !== false,
    social_nudges:     p.social_nudges     !== false,
  };
}

// ─── Individual notification senders ─────────────────────────────────────────

export async function notifyWorkoutReminder(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true, name: true },
  });

  if (!user?.pushToken) return false;

  const prefs = parsePrefs(user.notificationPrefs);
  if (!prefs.workout_reminders) return false;

  const firstName = user.name?.split(" ")[0] ?? "there";

  await sendPushNotification(user.pushToken, {
    title: "Time to train 💪",
    body: `Hey ${firstName}, your workout is scheduled. Let's get it done!`,
    data: { screen: "Workouts" },
  });

  return true;
}

export async function notifyMealNudge(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true, name: true },
  });

  if (!user?.pushToken) return false;

  const prefs = parsePrefs(user.notificationPrefs);
  if (!prefs.meal_nudges) return false;

  await sendPushNotification(user.pushToken, {
    title: "Log your meal 🍽️",
    body: "Don't forget to scan or log what you ate. Consistency is key!",
    data: { screen: "FoodScanner" },
  });

  return true;
}

export async function notifyProgressUpdate(
  userId: string,
  message: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true },
  });

  if (!user?.pushToken) return false;

  const prefs = parsePrefs(user.notificationPrefs);
  if (!prefs.progress_updates) return false;

  await sendPushNotification(user.pushToken, {
    title: "Progress update 📈",
    body:  message,
    data:  { screen: "Progress" },
  });

  return true;
}

export async function notifyWeeklyReview(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true, name: true },
  });

  if (!user?.pushToken) return false;

  const prefs = parsePrefs(user.notificationPrefs);
  if (!prefs.weekly_review) return false;

  const firstName = user.name?.split(" ")[0] ?? "there";

  await sendPushNotification(user.pushToken, {
    title: "Weekly review ready ✨",
    body:  `${firstName}, your AI progress review for this week is ready. Tap to see how you did!`,
    data:  { screen: "Progress" },
  });

  return true;
}

export async function notifyCheer(userId: string, fromUserName: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true },
  });

  if (!user?.pushToken) return false;

  const prefs = parsePrefs(user.notificationPrefs);
  if (!prefs.social_nudges) return false;

  const firstName = fromUserName?.split(" ")[0] ?? "A friend";

  await sendPushNotification(user.pushToken, {
    title: "You got a cheer! 👋",
    body: `${firstName} is cheering you on — keep it up!`,
    data: { screen: "Friends" },
  });

  return true;
}

// ─── Bulk senders (for cron jobs) ────────────────────────────────────────────

export async function broadcastWorkoutReminders(): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: {
      pushToken:          { not: null },
      onboardingCompleted: true,
    },
    select: { pushToken: true, notificationPrefs: true, name: true },
  });

  const tokens = users
    .filter((u) => {
      const prefs = parsePrefs(u.notificationPrefs);
      return u.pushToken && prefs.workout_reminders;
    })
    .map((u) => u.pushToken as string);

  if (tokens.length === 0) return { sent: 0, failed: 0 };

  return sendBulkNotifications(tokens, {
    title: "Time to train 💪",
    body:  "Your workout is waiting. Let's crush today's session!",
    data:  { screen: "Workouts" },
  });
}

export async function broadcastMealNudges(): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: {
      pushToken:          { not: null },
      onboardingCompleted: true,
    },
    select: { pushToken: true, notificationPrefs: true },
  });

  const tokens = users
    .filter((u) => {
      const prefs = parsePrefs(u.notificationPrefs);
      return u.pushToken && prefs.meal_nudges;
    })
    .map((u) => u.pushToken as string);

  if (tokens.length === 0) return { sent: 0, failed: 0 };

  return sendBulkNotifications(tokens, {
    title: "Log your meals 🍽️",
    body:  "Staying consistent with food tracking makes all the difference!",
    data:  { screen: "FoodScanner" },
  });
}

// Sunday-only: nudges users toward a notable workout plateau or body-composition
// change. Skips anyone with nothing notable rather than sending an empty check-in.
export async function broadcastProgressUpdates(): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: {
      pushToken:          { not: null },
      onboardingCompleted: true,
    },
    select: { id: true, pushToken: true, notificationPrefs: true },
  });

  const eligible = users.filter((u) => u.pushToken && parsePrefs(u.notificationPrefs).progress_updates);

  const candidates = await Promise.all(
    eligible.map(async (user) => {
      const [workoutSessions, bodyAssessments] = await Promise.all([
        prisma.workoutSession.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { exerciseName: true, weight: true, completedReps: true, createdAt: true },
        }),
        prisma.bodyAssessment.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 2,
          select: { bodyComposition: true },
        }),
      ]);

      const summary = buildTrendsSummary({
        plateaus: detectWorkoutPlateaus(workoutSessions),
        compositionDiffs: diffBodyComposition(
          bodyAssessments[0]?.bodyComposition as Record<string, unknown> | undefined,
          bodyAssessments[1]?.bodyComposition as Record<string, unknown> | undefined
        ),
      });

      return { pushToken: user.pushToken as string, message: summary ? summary.split("\n")[0].replace(/^-\s*/, "") : null };
    })
  );

  // Only attempt a send for users with something notable — nothing notable
  // is a normal skip, not a failure, so it shouldn't inflate `failed`.
  const toNotify = candidates.filter((c): c is { pushToken: string; message: string } => c.message !== null);

  const results = await Promise.allSettled(
    toNotify.map((c) =>
      sendPushNotification(c.pushToken, {
        title: "Progress update 📈",
        body: c.message,
        data: { screen: "Progress" },
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  return { sent, failed };
}

// Sunday-only, pro/elite tiers only: notifies that the weekly AI review is
// ready to view — the review itself is generated on-demand when they open the
// app (matches progress/review.ts's existing on-demand behavior), not
// pre-generated here, to avoid billing for reviews nobody looks at.
export async function broadcastWeeklyReviewReady(): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: {
      pushToken:          { not: null },
      onboardingCompleted: true,
    },
    select: {
      id: true,
      pushToken: true,
      notificationPrefs: true,
      subscription: {
        select: { plan: true, status: true, currentPeriodEnd: true, stripePriceId: true, tier: true },
      },
    },
  });

  const eligible = users.filter((u) => {
    if (!u.pushToken || !parsePrefs(u.notificationPrefs).weekly_review) return false;
    const { tier } = resolveTier(u.subscription);
    return TIER_LIMITS[tier].progressReviews;
  });

  const results = await Promise.allSettled(eligible.map((user) => notifyWeeklyReview(user.id)));

  const sent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  const failed = results.length - sent;
  return { sent, failed };
}
