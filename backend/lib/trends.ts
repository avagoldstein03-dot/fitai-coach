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

export interface WeightSeriesPoint {
  date: string;
  weight: number;
}

export interface WeightSeries {
  series: WeightSeriesPoint[];
  changeAbs: number;
  changePct: number;
}

export function buildWeightSeries(
  logs: Array<{ weight: number; loggedAt: Date }>
): WeightSeries | null {
  if (logs.length < 2) return null;

  const sorted = [...logs].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
  const series = sorted.map((log) => ({
    date: log.loggedAt.toISOString().split("T")[0],
    weight: log.weight,
  }));

  const first = sorted[0].weight;
  const last = sorted[sorted.length - 1].weight;
  const changeAbs = Math.round((last - first) * 10) / 10;
  const changePct = first !== 0 ? Math.round((changeAbs / first) * 1000) / 10 : 0;

  return { series, changeAbs, changePct };
}

export interface HealthMetricPoint {
  date: string;
  steps: number | null;
  activeEnergyKcal: number | null;
  sleepMinutes: number | null;
  restingHeartRate: number | null;
}

export function aggregateHealthMetrics(
  rows: Array<{
    date: Date;
    steps: number | null;
    activeEnergyKcal: number | null;
    sleepMinutes: number | null;
    restingHeartRate: number | null;
  }>
): { series: HealthMetricPoint[] } | null {
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const series = sorted.map((row) => ({
    date: row.date.toISOString().split("T")[0],
    steps: row.steps,
    activeEnergyKcal: row.activeEnergyKcal,
    sleepMinutes: row.sleepMinutes,
    restingHeartRate: row.restingHeartRate,
  }));

  return { series };
}

export interface MacroTrendPoint {
  date: string;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
}

interface MealForMacroTrend {
  createdAt: Date;
  totalCarbs: number | null;
  totalFat: number | null;
  totalFiber: number | null;
  foods: Array<{
    sugar: number | null;
    sodium: number | null;
    cholesterol: number | null;
  }>;
}

export function aggregateMacroTrend(meals: MealForMacroTrend[]): { series: MacroTrendPoint[] } | null {
  if (!meals.length) return null;

  const byDate = new Map<string, MacroTrendPoint>();
  for (const meal of meals) {
    const date = meal.createdAt.toISOString().split("T")[0];
    const point = byDate.get(date) ?? { date, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 };

    point.carbs += meal.totalCarbs ?? 0;
    point.fat += meal.totalFat ?? 0;
    point.fiber += meal.totalFiber ?? 0;
    for (const food of meal.foods) {
      point.sugar += food.sugar ?? 0;
      point.sodium += food.sodium ?? 0;
      point.cholesterol += food.cholesterol ?? 0;
    }

    byDate.set(date, point);
  }

  const series = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { series };
}

export interface WorkoutVolumePoint {
  date: string;
  volume: number;
}

export function computeWorkoutVolumeTrend(
  sessions: Array<{ createdAt: Date; weight: number | null; completedReps: string }>
): WorkoutVolumePoint[] {
  const byDate = new Map<string, number>();
  for (const session of sessions) {
    const date = session.createdAt.toISOString().split("T")[0];
    const reps = parseInt(session.completedReps, 10) || 0;
    const volume = (session.weight ?? 0) * reps;
    byDate.set(date, (byDate.get(date) ?? 0) + volume);
  }

  return [...byDate.entries()]
    .map(([date, volume]) => ({ date, volume: Math.round(volume) }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
