import type { WorkoutPlanWeek } from "@/services/ai-provider";

// Expands a single AI-authored week into a full multi-week program by applying
// straightforward progressive overload to the same exercises/sets/rep ranges,
// rather than asking the AI to hand-author every week — that's the difference
// between a ~10s and a ~40s generation for a 4-week program. Trades week-to-week
// exercise variety for speed.
export function expandWeekWithProgression(week1: WorkoutPlanWeek, durationWeeks: number): WorkoutPlanWeek[] {
  if (durationWeeks <= 1) return [{ ...week1, weekNumber: 1 }];

  const weeks: WorkoutPlanWeek[] = [{ ...week1, weekNumber: 1 }];

  for (let weekNumber = 2; weekNumber <= durationWeeks; weekNumber++) {
    weeks.push({
      weekNumber,
      progressionStrategy:
        "Progressive overload — increase working weight roughly 2.5-5% from last week (or add a rep or two per set if a weight increase isn't available), keeping the same exercises and rep ranges.",
      days: week1.days.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        exercises: day.exercises.map((exercise) => ({
          ...exercise,
          notes: exercise.notes
            ? `${exercise.notes} Week ${weekNumber}: add weight or reps vs. last week.`
            : `Week ${weekNumber}: add weight or reps vs. last week.`,
        })),
      })),
    });
  }

  return weeks;
}
