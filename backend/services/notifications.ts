import { sendPushNotification, sendBulkNotifications } from "./firebase";
import prisma from "@/lib/prisma";

export type NotificationPref =
  | "workout_reminders"
  | "meal_nudges"
  | "progress_updates"
  | "weekly_review";

interface NotifPrefs {
  workout_reminders: boolean;
  meal_nudges: boolean;
  progress_updates: boolean;
  weekly_review: boolean;
}

function defaultPrefs(): NotifPrefs {
  return {
    workout_reminders: true,
    meal_nudges:       true,
    progress_updates:  true,
    weekly_review:     true,
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
