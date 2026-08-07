import type { MealPlanDay } from "@/services/ai-provider";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Expands a small set of AI-authored template days into a full 7-day plan by
// rotating them across the week — same tradeoff as workout-progression.ts:
// asking the AI to hand-author all 7 unique days was the main driver of slow
// meal-plan generation. Trades some day-to-day variety for speed.
export function expandDaysWithRotation(templateDays: MealPlanDay[], targetDayCount = 7): MealPlanDay[] {
  if (!templateDays.length) return [];

  const days: MealPlanDay[] = [];
  for (let i = 0; i < targetDayCount; i++) {
    const template = templateDays[i % templateDays.length];
    days.push({ ...template, day: DAY_NAMES[i % DAY_NAMES.length] });
  }
  return days;
}
