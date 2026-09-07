import { Platform, Linking } from "react-native";
import axios from "axios";
import {
  getSdkStatus,
  initialize,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import { toDateKey, sumValueByDay, sumMinutesByDay } from "./health-aggregation";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Built into Android 14+; a separate Play Store app on Android 9-13.
const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";

// Stage values from SleepStageType that represent actually being asleep —
// excludes UNKNOWN (0), AWAKE (1), and OUT_OF_BED (3). Mirrors the iOS
// ASLEEP_VALUES exclusion of inBed/awake.
const ASLEEP_STAGES = new Set([2, 4, 5, 6]); // SLEEPING, LIGHT, DEEP, REM

const READ_PERMISSIONS = [
  { accessType: "read" as const, recordType: "Steps" as const },
  { accessType: "read" as const, recordType: "ActiveCaloriesBurned" as const },
  { accessType: "read" as const, recordType: "RestingHeartRate" as const },
  { accessType: "read" as const, recordType: "SleepSession" as const },
  { accessType: "read" as const, recordType: "Weight" as const },
];

interface DailyMetricPayload {
  date: string; // YYYY-MM-DD
  steps?: number;
  activeEnergyKcal?: number;
  sleepMinutes?: number;
  restingHeartRate?: number;
}

// This is a capability check ("does this OS support Health Connect at all"),
// not a "is it actually installed and provisioned" check — matches the
// existing iOS isHealthDataAvailable()'s own scope. Whether the Health
// Connect provider is actually installed is checked separately, on demand,
// inside ensureAvailable() below, since that's an async call.
export function isHealthDataAvailable(): boolean {
  return Platform.OS === "android";
}

// Resolves true if Health Connect is installed and ready; if not installed
// (possible on Android 9-13), opens its Play Store listing and resolves false.
async function ensureAvailable(): Promise<boolean> {
  if (!isHealthDataAvailable()) return false;

  const status = await getSdkStatus(HEALTH_CONNECT_PACKAGE);
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
    await initialize(HEALTH_CONNECT_PACKAGE);
    return true;
  }

  await Linking.openURL(`https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`).catch(() => {});
  return false;
}

// Resolving does NOT mean permission was granted for every requested type —
// same "completed the flow, not necessarily said yes" caveat as the iOS side.
export async function requestHealthPermissions(): Promise<void> {
  if (!(await ensureAvailable())) return;
  await requestPermission(READ_PERMISSIONS);
}

async function collectStepsByDay(startTime: string, endTime: string): Promise<Map<string, number>> {
  const { records } = await readRecords("Steps", { timeRangeFilter: { operator: "between", startTime, endTime } });
  return sumValueByDay(records.map((r) => ({ start: new Date(r.startTime), value: r.count })));
}

async function collectActiveEnergyByDay(startTime: string, endTime: string): Promise<Map<string, number>> {
  const { records } = await readRecords("ActiveCaloriesBurned", {
    timeRangeFilter: { operator: "between", startTime, endTime },
  });
  return sumValueByDay(records.map((r) => ({ start: new Date(r.startTime), value: r.energy.inKilocalories })));
}

async function collectSleepMinutesByDay(startTime: string, endTime: string): Promise<Map<string, number>> {
  const { records } = await readRecords("SleepSession", {
    timeRangeFilter: { operator: "between", startTime, endTime },
  });

  const asleepIntervals = records.flatMap((session) =>
    (session.stages ?? [])
      .filter((stage) => ASLEEP_STAGES.has(stage.stage))
      .map((stage) => ({ start: new Date(stage.startTime), end: new Date(stage.endTime) }))
  );

  return sumMinutesByDay(asleepIntervals);
}

async function collectRestingHeartRate(startTime: string, endTime: string): Promise<number | undefined> {
  const { records } = await readRecords("RestingHeartRate", {
    timeRangeFilter: { operator: "between", startTime, endTime },
    ascendingOrder: false,
    pageSize: 1,
  });
  return records[0]?.beatsPerMinute;
}

export async function collectDailyMetrics(days = 7): Promise<DailyMetricPayload[]> {
  if (!(await ensureAvailable())) return [];

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  const startTime = startDate.toISOString();
  const endTime = endDate.toISOString();

  const [steps, activeEnergy, sleepMinutes, restingHeartRate] = await Promise.all([
    collectStepsByDay(startTime, endTime),
    collectActiveEnergyByDay(startTime, endTime),
    collectSleepMinutesByDay(startTime, endTime),
    collectRestingHeartRate(startTime, endTime),
  ]);

  const allDayKeys = new Set([...steps.keys(), ...activeEnergy.keys(), ...sleepMinutes.keys()]);
  const todayKey = toDateKey(endDate);

  return Array.from(allDayKeys).map((date) => ({
    date,
    steps: steps.get(date),
    activeEnergyKcal: activeEnergy.get(date),
    sleepMinutes: sleepMinutes.get(date) != null ? Math.round(sleepMinutes.get(date)!) : undefined,
    // Resting heart rate is a single most-recent value, not a per-day series —
    // attach it to today's row only, matching the iOS behavior exactly.
    restingHeartRate: date === todayKey ? restingHeartRate : undefined,
  }));
}

export async function collectLatestWeightKg(): Promise<{ kg: number; sampleUuid: string; sampleDate: string } | null> {
  if (!(await ensureAvailable())) return null;

  const endTime = new Date().toISOString();
  const startTime = new Date(0).toISOString();
  const { records } = await readRecords("Weight", {
    timeRangeFilter: { operator: "between", startTime, endTime },
    ascendingOrder: false,
    pageSize: 1,
  });

  const latest = records[0];
  if (!latest) return null;
  return { kg: latest.weight.inKilograms, sampleUuid: latest.metadata?.id ?? latest.time, sampleDate: latest.time };
}

// Best-effort — callers should treat failures as non-fatal and not block on this.
export async function syncHealthData(): Promise<void> {
  if (!isHealthDataAvailable()) return;

  const [metrics, latestWeight] = await Promise.all([collectDailyMetrics(7), collectLatestWeightKg()]);
  if (!metrics.length && !latestWeight) return;

  await axios.post(`${API_URL}/api/health/sync`, {
    metrics,
    ...(latestWeight ? { latestWeight } : {}),
  });
}
