import { sendPushNotification, sendBulkNotifications } from "./firebase";
import prisma from "@/lib/prisma";
import { detectWorkoutPlateaus, diffBodyComposition, buildTrendsSummary } from "@/lib/trends";
import { resolveTier, TIER_LIMITS } from "@/lib/subscription-middleware";
import type { BadgeDefinition } from "@/lib/badges";

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

export async function notifyAchievementUnlocked(userId: string, badge: BadgeDefinition): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true },
  });

  if (!user?.pushToken) return false;

  const prefs = parsePrefs(user.notificationPrefs);
  if (!prefs.social_nudges) return false;

  await sendPushNotification(user.pushToken, {
    title: `${badge.emoji} Badge unlocked!`,
    body: `${badge.title} — ${badge.description}`,
    data: { screen: "Profile" },
  });

  return true;
}

export async function notifyOnboardingWelcome(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true, name: true },
  });

  if (!user?.pushToken) return false;

  const firstName = user.name?.split(" ")[0] ?? "there";

  await sendPushNotification(user.pushToken, {
    title: "You're in 👋",
    body: `Welcome, ${firstName} — check your readiness score whenever you're ready. No wearable needed.`,
    data: { screen: "Home" },
  });

  return true;
}

// D1/D3/D7 onboarding nudges — day is measured from User.createdAt.
export async function notifyOnboardingNudge(userId: string, day: 1 | 3 | 7): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true },
  });

  if (!user?.pushToken) return false;

  const copy: Record<1 | 3 | 7, { title: string; body: string; screen: string }> = {
    1: { title: "One more thing to try 📸", body: "Scan a barcode or a meal — takes about 5 seconds and the app gets more useful the more it knows.", screen: "FoodScanner" },
    3: { title: "Your coach is ready 🤖", body: "Ask it anything — nutrition, form, what to eat before a workout. It knows your goals already.", screen: "Coach" },
    7: { title: "Your first weekly review is ready ✨", body: "A full week of data, one AI-written debrief. See what it noticed.", screen: "Progress" },
  };

  const { title, body, screen } = copy[day];

  await sendPushNotification(user.pushToken, { title, body, data: { screen } });
  return true;
}

// D3/D7/D14 win-back nudges for lapsed free users — day is measured from
// last logged activity (most recent Meal or WorkoutSession), not signup.
export async function notifyWinBackNudge(userId: string, day: 3 | 7 | 14): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true, name: true },
  });

  if (!user?.pushToken) return false;

  const firstName = user.name?.split(" ")[0] ?? "there";

  const copy: Record<3 | 7 | 14, { title: string; body: string }> = {
    3: { title: "Still there? 👋", body: "Your readiness score is waiting whenever you check back in." },
    7: { title: `${firstName}, quick one`, body: "The weekly review only works with a few logged days — worth a quick scan today?" },
    14: { title: "One last thing", body: "We added a few things since you last opened the app — the ingredient scanner and precision macros. Worth a look." },
  };

  const { title, body } = copy[day];

  await sendPushNotification(user.pushToken, { title, body, data: { screen: "Home" } });
  return true;
}

// Fires once, at the moment a paying subscription actually expires (RevenueCat
// EXPIRATION webhook) — framed for after access has ended, not the "access
// continues until X" warning, since that would need a separate CANCELLATION
// handler this webhook doesn't implement yet (see revenuecat.ts).
export async function notifyPayingWinBack(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true },
  });

  if (!user?.pushToken) return false;

  await sendPushNotification(user.pushToken, {
    title: "Your Pro access just ended",
    body: "Your history and your coach's memory of your goals are still there — resubscribe anytime to pick back up.",
    data: { screen: "Pricing" },
  });

  return true;
}

export async function notifyReferralReward(userId: string, friendName: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, notificationPrefs: true },
  });

  if (!user?.pushToken) return false;

  const prefs = parsePrefs(user.notificationPrefs);
  if (!prefs.social_nudges) return false;

  const firstName = friendName?.split(" ")[0] ?? "Your friend";

  await sendPushNotification(user.pushToken, {
    title: "🎁 7 days of Pro, on us",
    body: `You connected with ${firstName} — enjoy a week of Pro as a thank you.`,
    data: { screen: "Profile" },
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

function daysAgoRange(daysAgo: number): { gte: Date; lt: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

// Daily, all users — checks each new-install day-bucket (1/3/7 days since
// signup) and sends the matching nudge. Date-range bucketing means each user
// only ever falls into one bucket per calendar day, so this is safe to run
// once daily without a separate "already sent" flag.
export async function broadcastOnboardingSequence(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const day of [1, 3, 7] as const) {
    const { gte, lt } = daysAgoRange(day);
    const users = await prisma.user.findMany({
      where: { pushToken: { not: null }, createdAt: { gte, lt } },
      select: { id: true },
    });

    const results = await Promise.allSettled(users.map((u) => notifyOnboardingNudge(u.id, day)));
    const bucketSent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    sent += bucketSent;
    failed += results.length - bucketSent;
  }

  return { sent, failed };
}

// Daily, onboarded users only — buckets by days since last logged activity
// (most recent Meal or WorkoutSession), not days since signup, so it targets
// people who actually went quiet rather than everyone who's simply old.
export async function broadcastWinBackSequence(): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { pushToken: { not: null }, onboardingCompleted: true },
    select: { id: true },
  });

  const withLastActivity = await Promise.all(
    users.map(async (u) => {
      const [lastMeal, lastWorkout] = await Promise.all([
        prisma.meal.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        prisma.workoutSession.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      ]);
      const dates = [lastMeal?.createdAt, lastWorkout?.createdAt].filter((d): d is Date => !!d);
      const lastActive = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
      return { id: u.id, lastActive };
    })
  );

  let sent = 0;
  let failed = 0;

  for (const day of [3, 7, 14] as const) {
    const { gte, lt } = daysAgoRange(day);
    const bucket = withLastActivity.filter((u) => u.lastActive && u.lastActive >= gte && u.lastActive < lt);

    const results = await Promise.allSettled(bucket.map((u) => notifyWinBackNudge(u.id, day)));
    const bucketSent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    sent += bucketSent;
    failed += results.length - bucketSent;
  }

  return { sent, failed };
}
