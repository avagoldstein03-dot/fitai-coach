import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import axios from "axios";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function setupNotificationHandler() {
  if (typeof Notifications.setNotificationHandler === "function") {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Active AI",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: T.green,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Get the Expo push token (works in Expo Go + managed workflow)
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  });

  return tokenData.data;
}

export async function registerTokenWithBackend(token: string): Promise<void> {
  try {
    await axios.post(`${API_URL}/api/notifications/register`, { token });
  } catch {
    // Best-effort — silent failure on token registration
  }
}

export async function unregisterFromBackend(): Promise<void> {
  try {
    await axios.delete(`${API_URL}/api/notifications/register`);
  } catch {
    // Best-effort
  }
}

export type NotifPrefs = {
  workout_reminders: boolean;
  meal_nudges:       boolean;
  progress_updates:  boolean;
  weekly_review:     boolean;
  social_nudges:     boolean;
};

export async function getNotificationPrefs(): Promise<NotifPrefs | null> {
  try {
    const res = await axios.get(`${API_URL}/api/notifications/preferences`);
    return res.data?.data?.prefs ?? null;
  } catch {
    return null;
  }
}

export async function updateNotificationPref(
  key: keyof NotifPrefs,
  value: boolean
): Promise<void> {
  await axios.patch(`${API_URL}/api/notifications/preferences`, { [key]: value });
}
