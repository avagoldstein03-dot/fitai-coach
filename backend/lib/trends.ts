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

export interface CrossDomainSignal {
  description: string;
}

interface WeekSplit {
  thisWeekAvg: number;
  lastWeekAvg: number;
  changePct: number;
}

// Splits date-stamped points into "most recent 7 days" vs. "the 7 days before
// that", relative to the latest date present (not necessarily today — a user
// might not have logged anything since yesterday). Returns null when either
// window has no data, which is the normal case for new users and must not
// produce a forced/noisy signal.
function splitIntoWeeks(points: Array<{ date: string; value: number }>): WeekSplit | null {
  if (!points.length) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const mostRecent = new Date(sorted[sorted.length - 1].date);

  const thisWeekStart = new Date(mostRecent);
  thisWeekStart.setDate(mostRecent.getDate() - 6);
  const lastWeekStart = new Date(mostRecent);
  lastWeekStart.setDate(mostRecent.getDate() - 13);
  const lastWeekEnd = new Date(mostRecent);
  lastWeekEnd.setDate(mostRecent.getDate() - 7);

  const thisWeekPoints = sorted.filter((p) => new Date(p.date) >= thisWeekStart);
  const lastWeekPoints = sorted.filter((p) => {
    const d = new Date(p.date);
    return d >= lastWeekStart && d <= lastWeekEnd;
  });

  if (!thisWeekPoints.length || !lastWeekPoints.length) return null;

  const avg = (pts: typeof thisWeekPoints) => pts.reduce((s, p) => s + p.value, 0) / pts.length;
  const thisWeekAvg = avg(thisWeekPoints);
  const lastWeekAvg = avg(lastWeekPoints);
  if (lastWeekAvg === 0) return null;

  return { thisWeekAvg, lastWeekAvg, changePct: ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 };
}

const SIGNIFICANT_CHANGE_PCT = 15;

// Heuristic pairings, not real statistics (no correlation coefficients) —
// flags a pairing only when both sides move meaningfully in the same
// direction over the same week. Deliberately small and fixed, matching the
// heuristic style of detectWorkoutPlateaus above, not an open-ended search
// for correlations across every possible pair of signals.
export function detectCrossDomainSignals(input: {
  healthSeries: HealthMetricPoint[] | null;
  volumeSeries: WorkoutVolumePoint[];
  weightLogs: Array<{ weight: number; loggedAt: Date }>;
}): CrossDomainSignal[] {
  const signals: CrossDomainSignal[] = [];

  const sleepPoints = (input.healthSeries ?? [])
    .filter((p): p is HealthMetricPoint & { sleepMinutes: number } => p.sleepMinutes != null)
    .map((p) => ({ date: p.date, value: p.sleepMinutes }));
  const rhrPoints = (input.healthSeries ?? [])
    .filter((p): p is HealthMetricPoint & { restingHeartRate: number } => p.restingHeartRate != null)
    .map((p) => ({ date: p.date, value: p.restingHeartRate }));
  const stepsPoints = (input.healthSeries ?? [])
    .filter((p): p is HealthMetricPoint & { steps: number } => p.steps != null)
    .map((p) => ({ date: p.date, value: p.steps }));
  const volumePoints = input.volumeSeries.map((p) => ({ date: p.date, value: p.volume }));
  const weightPoints = input.weightLogs.map((log) => ({
    date: log.loggedAt.toISOString().split("T")[0],
    value: log.weight,
  }));

  const sleep = splitIntoWeeks(sleepPoints);
  const rhr = splitIntoWeeks(rhrPoints);
  const steps = splitIntoWeeks(stepsPoints);
  const volume = splitIntoWeeks(volumePoints);
  const weight = splitIntoWeeks(weightPoints);

  const moved = (w: WeekSplit | null) => w !== null && Math.abs(w.changePct) >= SIGNIFICANT_CHANGE_PCT;
  const pct = (w: WeekSplit) => `${w.changePct > 0 ? "+" : ""}${Math.round(w.changePct)}%`;
  const hrs = (mins: number) => `${(mins / 60).toFixed(1)}h`;

  if (moved(sleep) && moved(volume)) {
    signals.push({
      description: `Average sleep changed ${pct(sleep!)} this week (${hrs(sleep!.lastWeekAvg)} → ${hrs(sleep!.thisWeekAvg)}) while total workout volume changed ${pct(volume!)} (${Math.round(volume!.lastWeekAvg)} → ${Math.round(volume!.thisWeekAvg)}) in the same period.`,
    });
  }

  if (moved(sleep) && moved(rhr)) {
    signals.push({
      description: `Average sleep changed ${pct(sleep!)} this week (${hrs(sleep!.lastWeekAvg)} → ${hrs(sleep!.thisWeekAvg)}) while resting heart rate changed ${pct(rhr!)} (${Math.round(rhr!.lastWeekAvg)} → ${Math.round(rhr!.thisWeekAvg)} bpm) in the same period.`,
    });
  }

  if (moved(steps) && moved(weight)) {
    signals.push({
      description: `Average daily steps changed ${pct(steps!)} this week (${Math.round(steps!.lastWeekAvg)} → ${Math.round(steps!.thisWeekAvg)}) while weight changed ${pct(weight!)} (${weight!.lastWeekAvg.toFixed(1)}kg → ${weight!.thisWeekAvg.toFixed(1)}kg) in the same period.`,
    });
  }

  if (moved(volume) && moved(weight)) {
    signals.push({
      description: `Total workout volume changed ${pct(volume!)} this week (${Math.round(volume!.lastWeekAvg)} → ${Math.round(volume!.thisWeekAvg)}) while weight changed ${pct(weight!)} (${weight!.lastWeekAvg.toFixed(1)}kg → ${weight!.thisWeekAvg.toFixed(1)}kg) in the same period.`,
    });
  }

  return signals;
}

export interface ReadinessFactor {
  name: string;
  impact: "positive" | "negative" | "neutral";
  detail: string;
}

export interface ReadinessResult {
  score: number;
  label: "primed" | "ready" | "take_it_easy" | "prioritize_recovery";
  factors: ReadinessFactor[];
}

interface BaselineComparison {
  latest: number;
  baselineAvg: number;
  changePct: number;
}

// Compares the single most recent data point against the average of the
// points before it. Requires at least `minBaseline` prior points to trust
// the baseline — with too little history the comparison is noise, not
// signal, so this returns null rather than a misleading result.
function compareLatestToBaseline(
  points: Array<{ date: string; value: number }>,
  minBaseline = 3
): BaselineComparison | null {
  if (points.length < minBaseline + 1) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1].value;
  const baseline = sorted.slice(0, -1);
  const baselineAvg = baseline.reduce((s, p) => s + p.value, 0) / baseline.length;
  if (baselineAvg === 0) return null;

  return { latest, baselineAvg, changePct: ((latest - baselineAvg) / baselineAvg) * 100 };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Deliberately a simple, transparent heuristic (weighted deltas from a
// personal baseline, clamped), not a validated clinical/sports-science
// model — the point is a trustworthy, explainable daily signal, not
// statistical rigor. Returns null when there's not enough data for even one
// component (new user, HealthKit never connected, no workouts logged) —
// no forced/fake score.
export function computeReadinessScore(input: {
  healthRows: Array<{ date: string; sleepMinutes: number | null; restingHeartRate: number | null }>;
  workoutSessions: Array<{ createdAt: Date; weight: number | null; completedReps: string }>;
}): ReadinessResult | null {
  const sleepPoints = input.healthRows
    .filter((r): r is typeof r & { sleepMinutes: number } => r.sleepMinutes != null)
    .map((r) => ({ date: r.date, value: r.sleepMinutes }));
  const rhrPoints = input.healthRows
    .filter((r): r is typeof r & { restingHeartRate: number } => r.restingHeartRate != null)
    .map((r) => ({ date: r.date, value: r.restingHeartRate }));
  const volumeByDate = computeWorkoutVolumeTrend(input.workoutSessions);

  const sleep = compareLatestToBaseline(sleepPoints);
  const rhr = compareLatestToBaseline(rhrPoints);
  const load = compareLatestToBaseline(volumeByDate.map((v) => ({ date: v.date, value: v.volume })));

  if (!sleep && !rhr && !load) return null;

  const factors: ReadinessFactor[] = [];
  let score = 100;

  if (sleep) {
    const delta = clamp(sleep.changePct * 0.4, -20, 20);
    score += delta;
    const hrs = (mins: number) => (mins / 60).toFixed(1);
    factors.push({
      name: "Sleep",
      impact: delta > 2 ? "positive" : delta < -2 ? "negative" : "neutral",
      detail: `Last night was ${hrs(sleep.latest)}h, ${Math.abs(Math.round(sleep.changePct))}% ${sleep.changePct >= 0 ? "above" : "below"} your recent average (${hrs(sleep.baselineAvg)}h).`,
    });
  }

  if (rhr) {
    const delta = clamp(-rhr.changePct * 0.5, -15, 15);
    score += delta;
    factors.push({
      name: "Resting heart rate",
      impact: delta > 2 ? "positive" : delta < -2 ? "negative" : "neutral",
      detail: `Resting heart rate was ${Math.abs(Math.round(rhr.changePct))}% ${rhr.changePct > 0 ? "above" : "below"} your recent average (${Math.round(rhr.baselineAvg)} bpm).`,
    });
  }

  if (load) {
    const delta = clamp(-load.changePct * 0.2, -15, 15);
    score += delta;
    factors.push({
      name: "Training load",
      impact: delta > 2 ? "positive" : delta < -2 ? "negative" : "neutral",
      detail: `Your last session's volume was ${Math.abs(Math.round(load.changePct))}% ${load.changePct > 0 ? "higher" : "lower"} than your recent average.`,
    });
  }

  score = clamp(Math.round(score), 0, 100);
  const label = score >= 80 ? "primed" : score >= 60 ? "ready" : score >= 40 ? "take_it_easy" : "prioritize_recovery";

  return { score, label, factors };
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
