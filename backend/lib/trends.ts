export function calculateStreak(records: Array<{ createdAt: Date }>): number {
  if (!records.length) return 0;

  const days = [...new Set(records.map((r) => r.createdAt.toISOString().split("T")[0]))].sort(
    (a, b) => b.localeCompare(a)
  );

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of days) {
    const d = new Date(day);
    const diff = Math.round((cursor.getTime() - d.getTime()) / 86_400_000);
    if (diff <= 1) {
      streak++;
      cursor = d;
    } else {
      break;
    }
  }

  return streak;
}

export interface PlateauInfo {
  exerciseName: string;
  weight: number | null;
  completedReps: string;
  sessionCount: number;
}

interface WorkoutSessionForTrends {
  exerciseName: string;
  weight: number | null;
  completedReps: string;
  createdAt: Date;
}

// Flags an exercise as plateaued when the same weight + reps show up across
// the last `minStreak`-or-more consecutive sessions of that exercise.
export function detectWorkoutPlateaus(
  sessions: WorkoutSessionForTrends[],
  minStreak = 3
): PlateauInfo[] {
  const byExercise = new Map<string, WorkoutSessionForTrends[]>();
  for (const session of sessions) {
    const list = byExercise.get(session.exerciseName) ?? [];
    list.push(session);
    byExercise.set(session.exerciseName, list);
  }

  const plateaus: PlateauInfo[] = [];

  for (const [exerciseName, list] of byExercise) {
    if (list.length < minStreak) continue;

    const sorted = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const [mostRecent, ...rest] = sorted;

    let matchCount = 1;
    for (const session of rest) {
      if (session.weight === mostRecent.weight && session.completedReps === mostRecent.completedReps) {
        matchCount++;
      } else {
        break;
      }
    }

    if (matchCount >= minStreak) {
      plateaus.push({
        exerciseName,
        weight: mostRecent.weight,
        completedReps: mostRecent.completedReps,
        sessionCount: matchCount,
      });
    }
  }

  return plateaus;
}

// Best-effort diff between two body-composition snapshots. Only compares
// keys present in BOTH records — the OpenAI and Anthropic providers return
// different shapes (e.g. {build, muscleDefinition} vs {estimatedBodyFat,
// muscleDefinition, estimatedBMI}), so a fixed schema can't be assumed.
export function diffBodyComposition(
  latest: Record<string, unknown> | null | undefined,
  previous: Record<string, unknown> | null | undefined
): string[] {
  if (!latest || !previous) return [];

  const diffs: string[] = [];
  for (const key of Object.keys(latest)) {
    if (!(key in previous)) continue;
    const latestValue = latest[key];
    const previousValue = previous[key];
    if (latestValue === previousValue) continue;
    if (latestValue == null || previousValue == null) continue;

    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toLowerCase());
    diffs.push(`${label}: ${previousValue} → ${latestValue}`);
  }

  return diffs;
}

export function buildTrendsSummary(input: { plateaus: PlateauInfo[]; compositionDiffs: string[] }): string {
  const lines: string[] = [];

  for (const plateau of input.plateaus.slice(0, 3)) {
    lines.push(
      `- ${plateau.exerciseName} has held steady at ${plateau.weight ?? "bodyweight"} for ${plateau.completedReps} reps across the last ${plateau.sessionCount} sessions — a plateau worth addressing.`
    );
  }

  for (const diff of input.compositionDiffs.slice(0, 3)) {
    lines.push(`- ${diff}`);
  }

  if (!lines.length) return "";

  return lines.join("\n").slice(0, 600);
}
