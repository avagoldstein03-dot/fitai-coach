import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useUpgradeGate, isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { formatWeight } from "@/lib/units";
import { T } from "@/lib/theme";
import LineTrendChart from "@/components/charts/LineTrendChart";
import BarTrendChart from "@/components/charts/BarTrendChart";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface AdvancedAnalyticsData {
  range: number;
  weight: { series: Array<{ date: string; weight: number }>; changeAbs: number; changePct: number } | null;
  health: {
    series: Array<{
      date: string;
      steps: number | null;
      activeEnergyKcal: number | null;
      sleepMinutes: number | null;
      restingHeartRate: number | null;
    }>;
  } | null;
  macros: {
    series: Array<{ date: string; carbs: number; fat: number; fiber: number; sugar: number; sodium: number; cholesterol: number }>;
  } | null;
  workouts: {
    volume: Array<{ date: string; volume: number }>;
    plateaus: Array<{ exerciseName: string; weight: number | null; completedReps: string; sessionCount: number }>;
  };
  bodyComposition: { diffs: string[] };
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdvancedAnalyticsScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const { presentUpgrade } = useUpgradeGate();
  const [range, setRange] = useState<"30" | "90">("30");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const { data, isLoading, isError, error } = useQuery<AdvancedAnalyticsData>({
    queryKey: ["advancedAnalytics", range],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/analytics/advanced?range=${range}`);
      return res.data.data;
    },
  });

  useEffect(() => {
    if (isError && isPremiumRequiredError(error)) {
      presentUpgrade();
      navigation.goBack();
    }
  }, [isError, error]);

  if (isLoading || (isError && isPremiumRequiredError(error))) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={s.loadingScreen}>
        <Text style={s.errorText}>{t("advanced_analytics.error")}</Text>
      </View>
    );
  }

  const weightPoints = data.weight?.series.map((p) => ({ x: shortDate(p.date), y: p.weight })) ?? [];
  const macroSeries = data.macros?.series ?? [];
  const carbsBars = macroSeries.map((p) => ({ x: shortDate(p.date), y: p.carbs }));
  const volumeBars = data.workouts.volume.map((p) => ({ x: shortDate(p.date), y: p.volume }));
  const stepsPoints = (data.health?.series ?? [])
    .filter((p) => p.steps != null)
    .map((p) => ({ x: shortDate(p.date), y: p.steps as number }));
  const sleepPoints = (data.health?.series ?? [])
    .filter((p) => p.sleepMinutes != null)
    .map((p) => ({ x: shortDate(p.date), y: p.sleepMinutes as number }));
  const hrPoints = (data.health?.series ?? [])
    .filter((p) => p.restingHeartRate != null)
    .map((p) => ({ x: shortDate(p.date), y: p.restingHeartRate as number }));

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.heading}>{t("advanced_analytics.title")} 📊</Text>
        <Text style={s.subheading}>{t("advanced_analytics.subtitle")}</Text>

        <View style={s.rangeToggle}>
          {(["30", "90"] as const).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRange(r)}
              style={[s.rangeBtn, range === r && s.rangeBtnActive]}
            >
              <Text style={[s.rangeBtnText, range === r && s.rangeBtnTextActive]}>
                {t(r === "30" ? "advanced_analytics.range_30" : "advanced_analytics.range_90")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weight trend */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("advanced_analytics.weight_trend")}</Text>
          {data.weight ? (
            <>
              <Text style={s.cardSub}>
                {data.weight.changeAbs >= 0 ? "+" : ""}
                {formatWeight(Math.abs(data.weight.changeAbs), profile?.unitSystem)} ({data.weight.changePct}%)
              </Text>
              <LineTrendChart points={weightPoints} color={T.accent} />
            </>
          ) : (
            <Text style={s.emptyText}>{t("advanced_analytics.no_weight_data")}</Text>
          )}
        </View>

        {/* Health trends */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("advanced_analytics.health_trends")}</Text>
          {data.health ? (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={s.cardSub}>{t("advanced_analytics.steps")}</Text>
                <LineTrendChart points={stepsPoints} color={T.teal} height={90} />
              </View>
              <View>
                <Text style={s.cardSub}>{t("advanced_analytics.sleep")}</Text>
                <LineTrendChart points={sleepPoints} color={T.blue} height={90} />
              </View>
              <View>
                <Text style={s.cardSub}>{t("advanced_analytics.resting_hr")}</Text>
                <LineTrendChart points={hrPoints} color={T.red} height={90} />
              </View>
            </View>
          ) : (
            <Text style={s.emptyText}>{t("advanced_analytics.no_health_data")}</Text>
          )}
        </View>

        {/* Macro breakdown */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("advanced_analytics.macro_trend")}</Text>
          {data.macros ? (
            <BarTrendChart bars={carbsBars} color={T.amber} />
          ) : (
            <Text style={s.emptyText}>{t("advanced_analytics.no_macro_data")}</Text>
          )}
        </View>

        {/* Workout volume & plateaus */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("advanced_analytics.workout_volume")}</Text>
          {data.workouts.volume.length > 0 ? (
            <BarTrendChart bars={volumeBars} color={T.teal} />
          ) : (
            <Text style={s.emptyText}>{t("advanced_analytics.no_workout_data")}</Text>
          )}
          {data.workouts.plateaus.length > 0 && (
            <View style={s.plateauList}>
              {data.workouts.plateaus.map((p) => (
                <Text key={p.exerciseName} style={s.plateauLine}>
                  {t("advanced_analytics.plateau_line", {
                    exercise: p.exerciseName,
                    weight: p.weight ?? t("advanced_analytics.bodyweight"),
                    reps: p.completedReps,
                    count: p.sessionCount,
                  })}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Body composition change */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("advanced_analytics.body_composition")}</Text>
          {data.bodyComposition.diffs.length > 0 ? (
            data.bodyComposition.diffs.map((d, i) => (
              <Text key={i} style={s.diffLine}>
                {d}
              </Text>
            ))
          ) : (
            <Text style={s.emptyText}>{t("advanced_analytics.no_composition_data")}</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  errorText: { color: T.textSecondary, fontSize: 14 },
  container: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 40 },
  back: { marginBottom: 12 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  heading: { fontSize: 24, fontWeight: "800", color: T.textPrimary },
  subheading: { fontSize: 13, color: T.textSecondary, marginTop: 4, marginBottom: 16 },
  rangeToggle: {
    flexDirection: "row",
    backgroundColor: T.surface2,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  rangeBtnActive: { backgroundColor: T.accent },
  rangeBtnText: { color: T.textSecondary, fontWeight: "600", fontSize: 13 },
  rangeBtnTextActive: { color: T.accentDark },
  card: {
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: T.textPrimary, fontWeight: "700", fontSize: 15, marginBottom: 8 },
  cardSub: { color: T.textSecondary, fontSize: 12, marginBottom: 8 },
  emptyText: { color: T.textMuted, fontSize: 13 },
  plateauList: { marginTop: 12, gap: 6 },
  plateauLine: { color: T.amber, fontSize: 12 },
  diffLine: { color: T.textSecondary, fontSize: 13, marginBottom: 4 },
});
