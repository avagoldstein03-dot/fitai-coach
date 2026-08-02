export interface DailyHealthMetricForSummary {
  date: Date;
  steps: number | null;
  activeEnergyKcal: number | null;
  sleepMinutes: number | null;
  restingHeartRate: number | null;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function nonNull(values: Array<number | null>): number[] {
  return values.filter((v): v is number => v != null);
}

// Expects `metrics` sorted most-recent-first (matches the query in chat.ts).
// Returns "" when there's nothing worth surfacing to the AI.
export function buildHealthSummary(metrics: DailyHealthMetricForSummary[]): string {
  if (!metrics.length) return "";

  const avgSteps = average(nonNull(metrics.map((m) => m.steps)));
  const avgSleepMinutes = average(nonNull(metrics.map((m) => m.sleepMinutes)));
  const avgActiveEnergy = average(nonNull(metrics.map((m) => m.activeEnergyKcal)));
  const mostRecentHeartRate = metrics.find((m) => m.restingHeartRate != null)?.restingHeartRate ?? null;

  const lines: string[] = [];

  if (avgSteps != null || avgSleepMinutes != null) {
    const parts: string[] = [];
    if (avgSteps != null) parts.push(`averaging ${Math.round(avgSteps)} steps/day`);
    if (avgSleepMinutes != null) parts.push(`${(avgSleepMinutes / 60).toFixed(1)}h sleep`);
    lines.push(`- ${parts.join(" and ")} over the last ${metrics.length} days (synced from Apple Health).`);
  }

  if (avgActiveEnergy != null) {
    lines.push(`- Averaging ${Math.round(avgActiveEnergy)} active kcal/day.`);
  }

  if (mostRecentHeartRate != null) {
    lines.push(`- Most recent resting heart rate: ${Math.round(mostRecentHeartRate)} bpm.`);
  }

  if (!lines.length) return "";

  return lines.join("\n").slice(0, 600);
}
