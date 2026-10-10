import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import { kgToLbs, lbsToKg } from "@/lib/units";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/** Offered as preset chips — a free number is more precision than anyone has. */
const TIMELINE_WEEKS = [8, 12, 16, 24, 52] as const;

interface GoalResponse {
  goal: {
    primaryGoal: string;
    targetWeight: number | null; // kg
    timeline: number | null; // weeks
  } | null;
  progress: {
    percentComplete: number;
    remainingKg: number;
    pace: string;
    weeksRemaining: number | null;
    requiredRateKgPerWeek: number | null;
    rateIsAggressive: boolean;
  } | null;
  /** False when a reported condition means a weight target should not be shown. */
  showWeightTarget: boolean;
}

const GOALS: { id: string; icon: string; color: string; bg: string; border: string }[] = [
  { id: "fat_loss",             icon: "⚡", color: T.amber,  bg: T.amberDark,  border: T.amberBorder  },
  { id: "muscle_gain",          icon: "💪", color: T.blue,   bg: T.blueDark,   border: T.blueBorder   },
  { id: "recomposition",        icon: "⚖️", color: T.teal,   bg: T.tealDark,   border: T.tealBorder   },
  { id: "athletic_performance", icon: "🏃", color: T.green,  bg: T.greenDark,  border: T.greenBorder  },
  { id: "general_health",       icon: "❤️", color: T.accent, bg: T.accentDark, border: T.accentBorder },
];

export default function EditGoalScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [selectedGoal, setSelectedGoal] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [timeline, setTimeline] = useState<number | null>(null);

  const { data, isLoading } = useQuery<GoalResponse>({
    queryKey: ["goal"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/goal`);
      return res.data.data;
    },
  });

  const { data: profile } = useQuery<{ unitSystem?: "imperial" | "metric" }>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const isImperial = (profile?.unitSystem ?? "imperial") === "imperial";
  // The server decides this, not the client — a weight countdown is withheld
  // for a reported disordered-eating history and during pregnancy.
  const showWeightTarget = data?.showWeightTarget !== false;

  // Seeded during render, guarded by a marker of the server values the fields
  // were last filled from — one pass instead of a render, an effect and a
  // second render, and it matches the Settings and Edit Profile screens.
  const [syncedFrom, setSyncedFrom] = useState<string | undefined>(undefined);
  const serverValues = data
    ? JSON.stringify([data.goal?.primaryGoal, data.goal?.targetWeight, data.goal?.timeline, isImperial])
    : undefined;

  if (serverValues !== undefined && serverValues !== syncedFrom) {
    setSyncedFrom(serverValues);
    if (data!.goal?.primaryGoal) setSelectedGoal(data!.goal.primaryGoal);
    if (data!.goal?.targetWeight != null) {
      setTargetWeight(
        isImperial
          ? String(Math.round(kgToLbs(data!.goal.targetWeight)))
          : String(Math.round(data!.goal.targetWeight * 10) / 10)
      );
    }
    if (data!.goal?.timeline != null) setTimeline(data!.goal.timeline);
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const typed = parseFloat(targetWeight);
      // An empty box clears the target rather than leaving a stale one behind.
      const targetKg = targetWeight.trim() === "" || Number.isNaN(typed)
        ? null
        : Math.round((isImperial ? lbsToKg(typed) : typed) * 10) / 10;

      await axios.patch(`${API_URL}/api/goal`, {
        primaryGoal: selectedGoal,
        ...(showWeightTarget ? { targetWeight: targetKg, timeline: targetKg == null ? null : timeline } : {}),
      });
    },
    onSuccess: () => {
      // The goal drives the calorie target and every generated program, so the
      // cached numbers are stale the moment it changes.
      for (const key of [["goal"], ["dashboard"], ["nutrition-targets"], ["nutritionTargets"], ["nutritionPlan"]]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      navigation.goBack();
    },
    onError: () => Alert.alert(t("common.error"), t("edit_goal.error_save")),
  });

  if (isLoading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    // Added with the goal-weight field — the screen had no text input before,
    // so the keyboard would have covered the save button.
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("edit_goal.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={s.optionList}>
          {GOALS.map((goal) => {
            const isSelected = selectedGoal === goal.id;
            return (
              <TouchableOpacity
                key={goal.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedGoal(goal.id); }}
                activeOpacity={0.8}
                style={[s.option, isSelected && { backgroundColor: goal.bg, borderColor: goal.border }]}
              >
                <View style={[s.iconCircle, { backgroundColor: goal.color + "22" }]}>
                  <Text style={s.iconEmoji}>{goal.icon}</Text>
                </View>
                <View style={s.optionBody}>
                  <Text style={[s.optionTitle, isSelected && { color: goal.color }]}>
                    {t(`onboarding.step2.${goal.id}`)}
                  </Text>
                  <Text style={[s.optionDesc, isSelected && { color: goal.color + "bb" }]}>{t(`onboarding.step2.${goal.id}_desc`)}</Text>
                </View>
                <View style={[s.checkCircle, isSelected && { backgroundColor: goal.color, borderColor: goal.color }]}>
                  {isSelected && <Text style={s.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Goal weight. The column existed from the start and no screen ever
            wrote it — so this is also the first time the target means anything.
            Withheld entirely when the server says so, rather than softened:
            there is no gentler version of a scale countdown. */}
        {showWeightTarget && (
          <View style={s.targetCard}>
            <Text style={s.sectionLabel}>{t("edit_goal.target_weight")}</Text>
            <View style={s.targetRow}>
              <TextInput
                style={s.targetInput}
                keyboardType="decimal-pad"
                value={targetWeight}
                onChangeText={setTargetWeight}
                placeholder={isImperial ? "150" : "68"}
                placeholderTextColor={T.textMuted}
              />
              <Text style={s.targetUnit}>{isImperial ? "lbs" : "kg"}</Text>
            </View>
            <Text style={s.hint}>{t("edit_goal.target_hint")}</Text>

            {!!targetWeight.trim() && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 18 }]}>{t("edit_goal.timeline")}</Text>
                <View style={s.chipWrap}>
                  {TIMELINE_WEEKS.map((w) => (
                    <TouchableOpacity
                      key={w}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTimeline(timeline === w ? null : w); }}
                      style={[s.chip, timeline === w && s.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: timeline === w }}
                    >
                      <Text style={[s.chipText, timeline === w && s.chipTextOn]}>
                        {t("edit_goal.weeks", { n: w })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Progress on what is already saved, plus the app saying so when
                the timeline the user chose implies a pace nobody should be
                coached into. A target is only useful if we will push back. */}
            {data?.progress && (
              <View style={s.progressBlock}>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${data.progress.percentComplete}%` as any }]} />
                </View>
                <Text style={s.progressText}>
                  {data.progress.pace === "met"
                    ? t("edit_goal.target_met")
                    : t("edit_goal.progress_line", {
                        pct: data.progress.percentComplete,
                        // The server works in kg; show it in whatever the user reads.
                        remaining: isImperial
                          ? Math.round(kgToLbs(data.progress.remainingKg))
                          : data.progress.remainingKg,
                        unit: isImperial ? "lbs" : "kg",
                      })}
                </Text>
                {/* The app saying the timeline is too tight, in the user's own
                    units. A target is only worth setting if we will push back
                    on it — and the fix we point at is more time, not less food. */}
                {data.progress.rateIsAggressive && data.progress.requiredRateKgPerWeek != null && (
                  <Text style={s.warningText}>
                    {t("edit_goal.rate_warning", {
                      rate: isImperial
                        ? (kgToLbs(data.progress.requiredRateKgPerWeek)).toFixed(1)
                        : data.progress.requiredRateKgPerWeek.toFixed(1),
                      unit: isImperial ? "lbs" : "kg",
                    })}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={() => save()}
          disabled={!selectedGoal || isPending}
          style={[s.saveBtn, (!selectedGoal || isPending) && s.saveBtnDisabled]}
        >
          {isPending ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>{t("common.save")}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  backBtn: { marginRight: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary },
  optionList: { gap: 10, marginTop: 8, marginBottom: 24 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconEmoji: { fontSize: 22 },
  optionBody: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 2 },
  optionDesc: { fontSize: 12, color: T.textMuted, lineHeight: 17 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkMark: { color: "#000", fontSize: 11, fontWeight: "800" },
  targetCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: T.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  targetRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  targetInput: {
    flex: 1,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: T.textPrimary,
    fontSize: 16,
  },
  targetUnit: { fontSize: 14, color: T.textMuted, fontWeight: "600", width: 32 },
  hint: { fontSize: 11.5, color: T.textMuted, marginTop: 8, lineHeight: 16 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: T.accentDark, borderColor: T.accent },
  chipText: { fontSize: 13, color: T.textSecondary, fontWeight: "600" },
  chipTextOn: { color: T.accent },
  progressBlock: { marginTop: 18, gap: 8 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: T.surface2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: T.accent },
  progressText: { fontSize: 12.5, color: T.textSecondary },
  warningText: { fontSize: 12, color: T.amber, lineHeight: 17 },
  saveBtn: { backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: T.surface },
  saveBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
