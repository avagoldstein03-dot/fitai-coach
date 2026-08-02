import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  registerForPushNotifications,
  registerTokenWithBackend,
  unregisterFromBackend,
  updateNotificationPref,
  NotifPrefs,
} from "@/services/notifications";
import axios from "axios";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const PREF_ROW_KEYS: Array<{ key: keyof NotifPrefs; labelKey: string; descKey: string; icon: string }> = [
  { key: "workout_reminders", labelKey: "notifications.workout_reminders", descKey: "notifications.workout_reminders_desc", icon: "💪" },
  { key: "meal_nudges",       labelKey: "notifications.meal_nudges",       descKey: "notifications.meal_nudges_desc",       icon: "🍽️" },
  { key: "progress_updates",  labelKey: "notifications.progress_updates",  descKey: "notifications.progress_updates_desc",  icon: "📈" },
  { key: "weekly_review",     labelKey: "notifications.weekly_review",     descKey: "notifications.weekly_review_desc",     icon: "✨" },
  { key: "social_nudges",     labelKey: "notifications.social_nudges",     descKey: "notifications.social_nudges_desc",     icon: "👋" },
];

export default function NotificationsScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [isEnabling, setIsEnabling] = useState(false);

  const { data: prefData, isLoading } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/notifications/preferences`);
      return res.data?.data as { prefs: NotifPrefs; hasToken: boolean };
    },
  });

  const prefs = prefData?.prefs;
  const hasToken = prefData?.hasToken ?? false;

  const { mutate: togglePref } = useMutation({
    mutationFn: async ({ key, value }: { key: keyof NotifPrefs; value: boolean }) => {
      await updateNotificationPref(key, value);
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: ["notification-prefs"] });
      const previous = queryClient.getQueryData(["notification-prefs"]);
      queryClient.setQueryData(["notification-prefs"], (old: any) => ({
        ...old,
        prefs: { ...old?.prefs, [key]: value },
      }));
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      queryClient.setQueryData(["notification-prefs"], context.previous);
      Alert.alert(t("common.error"), t("notifications.error_update"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
  });

  const enableNotifications = async () => {
    setIsEnabling(true);
    try {
      const token = await registerForPushNotifications();
      if (!token) {
        Alert.alert(
          t("notifications.permission_title"),
          t("notifications.permission_msg"),
          [{ text: t("common.ok") }]
        );
        return;
      }
      await registerTokenWithBackend(token);
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    } catch (err) {
      Alert.alert(t("common.error"), t("notifications.error_enable"));
    } finally {
      setIsEnabling(false);
    }
  };

  const disableNotifications = () => {
    Alert.alert(
      t("notifications.disable_title"),
      t("notifications.disable_msg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.disable"),
          style: "destructive",
          onPress: async () => {
            await unregisterFromBackend();
            queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("notifications.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          {hasToken ? (
            <>
              <View style={s.statusRow}>
                <Text style={s.statusIcon}>🔔</Text>
                <Text style={s.cardTitle}>{t("notifications.title")}</Text>
              </View>
              <Text style={s.cardSub}>
                {t("notifications.subtitle")}
              </Text>
              <TouchableOpacity onPress={disableNotifications} style={s.disableBtn}>
                <Text style={s.disableBtnText}>{t("notifications.disable_button")}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={s.statusRow}>
                <Text style={s.statusIcon}>🔕</Text>
                <Text style={s.cardTitle}>{t("notifications.title")}</Text>
              </View>
              <Text style={s.cardSub}>
                {t("notifications.subtitle")}
              </Text>
              <TouchableOpacity
                onPress={enableNotifications}
                disabled={isEnabling}
                style={[s.enableBtn, isEnabling && s.enableBtnDisabled]}
              >
                {isEnabling ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={s.enableBtnText}>{t("notifications.enable_button")}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {hasToken && prefs && (
          <View style={s.prefsSection}>
            <Text style={s.sectionLabel}>{t("notifications.title")}</Text>
            <View style={s.prefsCard}>
              {PREF_ROW_KEYS.map((row, i) => (
                <View
                  key={row.key}
                  style={[s.prefRow, i < PREF_ROW_KEYS.length - 1 && s.prefRowBorder]}
                >
                  <Text style={s.prefIcon}>{row.icon}</Text>
                  <View style={s.prefInfo}>
                    <Text style={s.prefLabel}>{t(row.labelKey)}</Text>
                    <Text style={s.prefDesc}>{t(row.descKey)}</Text>
                  </View>
                  <Switch
                    value={prefs[row.key]}
                    onValueChange={(val) => togglePref({ key: row.key, value: val })}
                    trackColor={{ false: T.border, true: T.accent }}
                    thumbColor={prefs[row.key] ? "#000" : T.textMuted}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.infoCard}>
          <Text style={s.infoText}>
            Notifications are sent at optimal times based on your schedule. Workout
            reminders go out at 8 AM, meal nudges at 12 PM and 6 PM. You can also
            manage notifications in your device Settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  backBtn: { marginRight: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary },
  card: {
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  statusIcon: { fontSize: 22, marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: T.textPrimary },
  cardSub: { fontSize: 13, color: T.textSecondary, lineHeight: 19, marginBottom: 16 },
  disableBtn: { borderWidth: 1, borderColor: T.red, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  disableBtnText: { color: T.red, fontWeight: "600" },
  enableBtn: { backgroundColor: T.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  enableBtnDisabled: { backgroundColor: T.surface },
  enableBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  prefsSection: { marginHorizontal: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
  prefsCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  prefRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  prefRowBorder: { borderBottomWidth: 1, borderBottomColor: T.border },
  prefIcon: { fontSize: 22, marginRight: 12 },
  prefInfo: { flex: 1, marginRight: 12 },
  prefLabel: { fontSize: 14, fontWeight: "600", color: T.textPrimary },
  prefDesc: { fontSize: 12, color: T.textSecondary, marginTop: 2 },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
  },
  infoText: { fontSize: 12, color: T.textMuted, lineHeight: 18 },
});
