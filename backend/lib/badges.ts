export interface BadgeDefinition {
  key: string;
  emoji: string;
  title: string;
  description: string;
}

// Fixed, in-code catalog — thresholds are checked against live counts in
// backend/services/badges.ts, not stored here. Supersedes the old
// client-side-only badge list in frontend/screens/profile/ProfileScreen.tsx,
// which recomputed "earned" from this-week-only stats (so a badge could
// silently un-earn itself the following week) rather than a real persisted
// all-time record.
export const BADGE_CATALOG: BadgeDefinition[] = [
  { key: "first_workout", emoji: "🏋️", title: "First Workout", description: "Logged your first workout session" },
  { key: "first_meal", emoji: "🍽️", title: "First Meal", description: "Logged your first meal" },
  { key: "first_body_scan", emoji: "📸", title: "First Scan", description: "Completed your first body assessment" },
  { key: "first_friend", emoji: "🤝", title: "Made a Friend", description: "Connected with a friend" },
  { key: "streak_3", emoji: "🔥", title: "3-Day Streak", description: "3 days in a row logging workouts or meals" },
  { key: "streak_7", emoji: "⚡", title: "Week Champion", description: "7 days in a row logging workouts or meals" },
  { key: "streak_14", emoji: "💪", title: "Two-Week Streak", description: "14 days in a row logging workouts or meals" },
  { key: "streak_30", emoji: "🏆", title: "30-Day Streak", description: "30 days in a row logging workouts or meals" },
  { key: "ten_workouts", emoji: "💯", title: "Ten Workouts", description: "Logged 10 workout sessions" },
];
