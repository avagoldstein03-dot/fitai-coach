import { Platform } from "react-native";
import axios from "axios";
import {
  isHealthDataAvailable,
  requestAuthorization,
  queryStatisticsCollectionForQuantity,
  queryCategorySamples,
  getMostRecentQuantitySample,
} from "@kingstinct/react-native-healthkit";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const READ_TYPES = [
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKCategoryTypeIdentifierSleepAnalysis",
  "HKQuantityTypeIdentifierBodyMass",
] as const;

// Values from CategoryValueSleepAnalysis that represent actually being
// asleep — excludes inBed (0) and awake (2).
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);

interface DailyMetricPayload {
  date: string; // YYYY-MM-DD
  steps?: number;
  activeEnergyKcal?: number;
  sleepMinutes?: number;
  restingHeartRate?: number;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isHealthKitAvailable(): boolean {
  return Platform.OS === "ios" && isHealthDataAvailable();
}

// Resolving does NOT mean permission was granted — HealthKit read-permission
// grant/deny state is intentionally unobservable by design. Treat this as
// "the user completed the request flow," not "the user said yes."
export async function requestHealthPermissions(): Promise<void> {
  if (!isHealthKitAvailable()) return;
  // Cast via the function's own parameter type rather than naming HealthKit's
  // identifier union directly — READ_TYPES are verified-correct Apple HealthKit
  // constants, just typed here as a plain readonly string tuple for simplicity.
  await requestAuthorization({ toRead: READ_TYPES } as Parameters<typeof requestAuthorization>[0]);
}

async function collectDailySumMetric(
  identifier: "HKQuantityTypeIdentifierStepCount" | "HKQuantityTypeIdentifierActiveEnergyBurned",
  unit: "count" | "kcal",
  startDate: Date,
  endDate: Date
): Promise<Map<string, number>> {
  const results = await queryStatisticsCollectionForQuantity(identifier, ["cumulativeSum"], startDate, { day: 1 }, {
    unit,
    filter: { date: { startDate, endDate } },
  });

  const byDay = new Map<string, number>();
  for (const bucket of results) {
    if (!bucket.startDate || bucket.sumQuantity == null) continue;
    byDay.set(toDateKey(bucket.startDate), bucket.sumQuantity.quantity);
  }
  return byDay;
}

async function collectSleepMinutesByDay(startDate: Date, endDate: Date): Promise<Map<string, number>> {
  const samples = await queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis", {
    limit: 0,
    filter: { date: { startDate, endDate } },
  });

  const byDay = new Map<string, number>();
  for (const sample of samples) {
    if (!ASLEEP_VALUES.has(sample.value)) continue;
    const minutes = (sample.endDate.getTime() - sample.startDate.getTime()) / 60_000;
    const key = toDateKey(sample.startDate);
    byDay.set(key, (byDay.get(key) ?? 0) + minutes);
  }
  return byDay;
}

async function collectRestingHeartRate(): Promise<number | undefined> {
  const sample = await getMostRecentQuantitySample("HKQuantityTypeIdentifierRestingHeartRate", "count/min");
  return sample?.quantity;
}

export async function collectDailyMetrics(days = 7): Promise<DailyMetricPayload[]> {
  if (!isHealthKitAvailable()) return [];

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const [steps, activeEnergy, sleepMinutes, restingHeartRate] = await Promise.all([
    collectDailySumMetric("HKQuantityTypeIdentifierStepCount", "count", startDate, endDate),
    collectDailySumMetric("HKQuantityTypeIdentifierActiveEnergyBurned", "kcal", startDate, endDate),
    collectSleepMinutesByDay(startDate, endDate),
    collectRestingHeartRate(),
  ]);

  const allDayKeys = new Set([...steps.keys(), ...activeEnergy.keys(), ...sleepMinutes.keys()]);
  const todayKey = toDateKey(endDate);

  return Array.from(allDayKeys).map((date) => ({
    date,
    steps: steps.get(date),
    activeEnergyKcal: activeEnergy.get(date),
    sleepMinutes: sleepMinutes.get(date) != null ? Math.round(sleepMinutes.get(date)!) : undefined,
    // Resting heart rate is a single most-recent value, not a per-day series —
    // attach it to today's row only.
    restingHeartRate: date === todayKey ? restingHeartRate : undefined,
  }));
}

export async function collectLatestWeightKg(): Promise<{ kg: number; sampleUuid: string; sampleDate: string } | null> {
  if (!isHealthKitAvailable()) return null;
  const sample = await getMostRecentQuantitySample("HKQuantityTypeIdentifierBodyMass", "kg");
  if (!sample) return null;
  return { kg: sample.quantity, sampleUuid: sample.uuid, sampleDate: sample.startDate.toISOString() };
}

// Best-effort — callers should treat failures as non-fatal and not block on this.
export async function syncHealthData(): Promise<void> {
  if (!isHealthKitAvailable()) return;

  const [metrics, latestWeight] = await Promise.all([collectDailyMetrics(7), collectLatestWeightKg()]);
  if (!metrics.length && !latestWeight) return;

  await axios.post(`${API_URL}/api/health/sync`, {
    metrics,
    ...(latestWeight ? { latestWeight } : {}),
  });
}
