import prisma from "@/lib/prisma";
import { calculateStreak } from "@/lib/trends";
import { BADGE_CATALOG, type BadgeDefinition } from "@/lib/badges";
import { notifyAchievementUnlocked } from "./notifications";

// Checks all-time counts + the current streak against the fixed catalog and
// awards any newly-crossed badge. Idempotent — the @@unique([userId,
// badgeKey]) constraint means a badge already earned is never re-awarded or
// re-notified, so this is safe to call on every relevant action without
// tracking "did I already check this" state separately.
export async function checkAndAwardBadges(userId: string): Promise<BadgeDefinition[]> {
  const [workoutCount, mealCount, bodyScanCount, friendCount, workoutSessions, meals, alreadyEarned] =
    await Promise.all([
      prisma.workoutSession.count({ where: { userId } }),
      prisma.meal.count({ where: { userId } }),
      prisma.bodyAssessment.count({ where: { userId } }),
      prisma.friendConnection.count({ where: { userId } }),
      prisma.workoutSession.findMany({ where: { userId }, select: { createdAt: true } }),
      prisma.meal.findMany({ where: { userId }, select: { createdAt: true } }),
      prisma.userBadge.findMany({ where: { userId }, select: { badgeKey: true } }),
    ]);

  const streak = Math.max(calculateStreak(workoutSessions), calculateStreak(meals));
  const earnedKeys = new Set(alreadyEarned.map((b) => b.badgeKey));

  const qualifies: Record<string, boolean> = {
    first_workout: workoutCount >= 1,
    first_meal: mealCount >= 1,
    first_body_scan: bodyScanCount >= 1,
    first_friend: friendCount >= 1,
    streak_3: streak >= 3,
    streak_7: streak >= 7,
    streak_14: streak >= 14,
    streak_30: streak >= 30,
    ten_workouts: workoutCount >= 10,
  };

  const newlyEarned = BADGE_CATALOG.filter((b) => qualifies[b.key] && !earnedKeys.has(b.key));
  if (!newlyEarned.length) return [];

  await Promise.all(
    newlyEarned.map((b) =>
      prisma.userBadge.upsert({
        where: { userId_badgeKey: { userId, badgeKey: b.key } },
        update: {},
        create: { userId, badgeKey: b.key },
      })
    )
  );

  await Promise.allSettled(newlyEarned.map((b) => notifyAchievementUnlocked(userId, b)));

  return newlyEarned;
}
