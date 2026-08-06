import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useUpgradeGate, isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { formatWeight } from "@/lib/units";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function HabitHeatmap({ dailyData }: { dailyData: Array<{ date: string; mealCount: number }> }) {
  const { t } = useTranslation();
  const DAYS = 28;
  const cells = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const date = d.toISOString().split("T")[0];
    const found = dailyData.find((day) => day.date === date);
    return { date, count: found?.mealCount ?? 0, isToday: i === DAYS - 1 };
  });

  const logged = cells.filter((c) => c.count > 0).length;
  const pct = Math.round((logged / DAYS) * 100);
  const weeks = [cells.slice(0, 7), cells.slice(7, 14), cells.slice(14, 21), cells.slice(21, 28)];

  return (
    <View style={s.heatmapCard}>
      <View style={s.heatmapHeader}>
        <View>
          <Text style={s.heatmapTitle}>{t("progress.meal_consistency")}</Text>
          <Text style={s.heatmapSub}>{t("progress.last_28_days")}</Text>
        </View>
        <View style={[s.heatmapBadge, pct >= 70 && s.heatmapBadgeGood]}>
          <Text style={[s.heatmapBadgeText, pct >= 70 && s.heatmapBadgeTextGood]}>{pct}%</Text>
        </View>
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={s.heatmapWeek}>
          {week.map((cell, di) => {
            const alpha = cell.count === 0 ? 0 : cell.count === 1 ? 0.35 : cell.count === 2 ? 0.65 : 1;
            const bg = alpha === 0 ? T.surface2 : `rgba(200,255,71,${alpha})`;
            return (
              <View
                key={di}
                style={[
                  s.heatmapCell,
                  { backgroundColor: bg },
                  cell.isToday && s.heatmapCellToday,
                ]}
              />
            );
          })}
        </View>
      ))}
      <View style={s.heatmapLegend}>
        <Text style={s.heatmapLegendLabel}>{t("progress.no_meals_heat")}</Text>
        {[0, 0.35, 0.65, 1].map((a, i) => (
          <View
            key={i}
            style={[s.heatmapLegendDot, { backgroundColor: a === 0 ? T.surface2 : `rgba(200,255,71,${a})` }]}
          />
        ))}
        <Text style={s.heatmapLegendLabel}>{t("progress.meals_3_plus")}</Text>
      </View>
    </View>
  );
}

interface ReviewData {
  period: string;
  stats: {
    mealsLogged: number;
    workoutsCompleted: number;
    avgDailyCalories: number;
    avgDailyProtein: number;
  };
  review: {
    wins: string[];
    insight?: string;
    adjustment?: string;
    closing: string;
  };
}

interface DashboardData {
  currentWeight: number | null;
  physiqueNote: string | null;
  thisWeek: { mealsLogged: number; workoutsCompleted: number };
}

export default function ProgressScreen() {
  const navigation = useNavigation() as any;
  const { presentUpgrade } = useUpgradeGate();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [review, setReview] = useState<ReviewData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const { data: historyData } = useQuery({
    queryKey: ["food-history", "diary"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/food/history?days=30&limit=200`);
      return res.data?.data as { dailyData: Array<{ date: string; mealCount: number }> };
    },
    staleTime: 30_000,
  });

  const { data: dashData, isLoading: loadingDash, refetch, isRefetching } =
    useQuery<DashboardData>({
      queryKey: ["dashboard"],
      queryFn: async () => {
        const res = await axios.get(`${API_URL}/api/analytics/dashboard`);
        return res.data.data;
      },
      staleTime: 60_000,
    });

  const generateReview = async () => {
    setIsGenerating(true);
    try {
      const res = await axios.get(`${API_URL}/api/progress/review?period=${period}`);
      setReview(res.data.data);
    } catch (err: any) {
      if (isPremiumRequiredError(err)) {
        presentUpgrade();
      } else {
        Alert.alert(t("common.error"), t("progress.error_review"));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (loadingDash) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.accent} />}
    >
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.heading}>{t("progress.title")} 📈</Text>

        {/* Habit Heatmap */}
        {historyData?.dailyData && (
          <HabitHeatmap dailyData={historyData.dailyData} />
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>{t("dashboard.current_weight")}</Text>
            <Text style={s.statValue}>{formatWeight(dashData?.currentWeight, profile?.unitSystem)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>{t("dashboard.physique_note")}</Text>
            <Text style={s.statValue}>{dashData?.physiqueNote ?? "--"}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>{t("progress.workouts")}</Text>
            <Text style={s.statValue}>{dashData?.thisWeek.workoutsCompleted ?? 0}</Text>
            <Text style={s.statSub}>{t("dashboard.this_week")}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>{t("weekly_review.meals_logged")}</Text>
            <Text style={s.statValue}>{dashData?.thisWeek.mealsLogged ?? 0}</Text>
            <Text style={s.statSub}>{t("dashboard.this_week")}</Text>
          </View>
        </View>

        {/* CTAs */}
        <TouchableOpacity style={s.bodyScanBtn} onPress={() => navigation.navigate("BodyScan")}>
          <Text style={s.bodyScanIcon}>🤖</Text>
          <View>
            <Text style={s.bodyScanTitle}>{t("progress.ai_scan_title")}</Text>
            <Text style={s.bodyScanSub}>{t("progress.ai_scan_sub")}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.photosBtn} onPress={() => navigation.navigate("ProgressPhotos")}>
          <Text style={s.photosBtnIcon}>📸</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.photosBtnTitle}>{t("progress.photos")}</Text>
            <Text style={s.photosBtnSub}>{t("progress.photos_sub")}</Text>
          </View>
          <Text style={s.arrow}>→</Text>
        </TouchableOpacity>

        {/* AI Progress Review */}
        <View style={s.reviewCard}>
          <Text style={s.reviewTitle}>{t("progress.weekly_review")}</Text>
          <Text style={s.reviewSub}>{t("progress.weekly_review_sub")}</Text>

          <View style={s.periodToggle}>
            {(["weekly", "monthly"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPeriod(p); setReview(null); }}
                style={[s.periodBtn, period === p && s.periodBtnActive]}
              >
                <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.generateBtn, isGenerating && s.generateBtnDisabled]}
            onPress={generateReview}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator color="#000" size="small" />
                <Text style={s.generateBtnText}> {t("weekly_review.generating")}</Text>
              </>
            ) : (
              <Text style={s.generateBtnText}>
                ✨ Generate {period.charAt(0).toUpperCase() + period.slice(1)} Review
              </Text>
            )}
          </TouchableOpacity>

          {review && (
            <View style={s.reviewResult}>
              <View style={s.reviewStatsRow}>
                {[
                  { label: t("weekly_review.meals_logged"), value: String(review.stats.mealsLogged) },
                  { label: t("weekly_review.workouts_completed"), value: String(review.stats.workoutsCompleted) },
                  { label: t("weekly_review.avg_calories"), value: `${review.stats.avgDailyCalories}` },
                  { label: t("food_scanner.avg_protein"), value: `${review.stats.avgDailyProtein}g` },
                ].map((s_) => (
                  <View key={s_.label} style={s.reviewStatItem}>
                    <Text style={s.reviewStatValue}>{s_.value}</Text>
                    <Text style={s.reviewStatLabel}>{s_.label}</Text>
                  </View>
                ))}
              </View>

              <View style={s.reviewHighlightBox}>
                <Text style={s.reviewHighlightLabel}>🌟 {t("weekly_review.highlights_title")}</Text>
                {review.review.wins.map((win, i) => (
                  <Text key={i} style={s.reviewHighlightText}>✓ {win}</Text>
                ))}
              </View>

              <View style={s.reviewTextBox}>
                <Text style={s.reviewTextLabel}>{t("weekly_review.ai_review")}</Text>
                {review.review.insight ? <Text style={s.reviewText}>{review.review.insight}</Text> : null}
                {review.review.adjustment ? <Text style={s.reviewText}>{review.review.adjustment}</Text> : null}
                <Text style={s.reviewText}>{review.review.closing}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Supplements */}
        <TouchableOpacity style={s.supplementsBtn} onPress={() => navigation.navigate("Supplements")}>
          <Text style={s.supplementsIcon}>💊</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.supplementsTitle}>{t("progress.supplements_link")}</Text>
            <Text style={s.supplementsSub}>{t("progress.supplements_link_sub")}</Text>
          </View>
          <Text style={s.arrow}>→</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  container: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 40 },
  back: { marginBottom: 12 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  heading: { fontSize: 24, fontWeight: "800", color: T.textPrimary, marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
  },
  statLabel: { fontSize: 11, color: T.textMuted, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "700", color: T.textPrimary },
  statSub: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  bodyScanBtn: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  bodyScanIcon: { fontSize: 24 },
  bodyScanTitle: { color: T.textPrimary, fontWeight: "600", fontSize: 14 },
  bodyScanSub: { color: T.accentMuted, fontSize: 12, marginTop: 2 },
  photosBtn: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  photosBtnIcon: { fontSize: 24 },
  photosBtnTitle: { color: T.textPrimary, fontWeight: "600", fontSize: 14 },
  photosBtnSub: { color: T.textSecondary, fontSize: 12, marginTop: 2 },
  arrow: { color: T.textMuted, fontSize: 16 },
  reviewCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 16,
  },
  reviewTitle: { fontSize: 16, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  reviewSub: { fontSize: 12, color: T.textSecondary, marginBottom: 16 },
  periodToggle: {
    flexDirection: "row",
    backgroundColor: T.bg,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  periodBtnActive: { backgroundColor: T.accent },
  periodBtnText: { fontSize: 13, fontWeight: "600", color: T.textSecondary, textTransform: "capitalize" },
  periodBtnTextActive: { color: "#000" },
  generateBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  generateBtnDisabled: { backgroundColor: T.surface },
  generateBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },
  reviewResult: { marginTop: 16 },
  reviewStatsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  reviewStatItem: {
    flex: 1,
    backgroundColor: T.bg,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  reviewStatValue: { fontSize: 14, fontWeight: "700", color: T.textPrimary },
  reviewStatLabel: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  reviewTextBox: { backgroundColor: T.bg, borderRadius: 12, padding: 16, gap: 6 },
  reviewTextLabel: { fontSize: 12, fontWeight: "700", color: T.accent, marginBottom: 2 },
  reviewText: { fontSize: 13, color: T.textPrimary, lineHeight: 20 },
  reviewHighlightBox: { backgroundColor: T.greenDark, borderRadius: 12, borderWidth: 1, borderColor: T.greenBorder, padding: 16, marginBottom: 10, gap: 6 },
  reviewHighlightLabel: { fontSize: 12, fontWeight: "800", color: T.green, marginBottom: 2 },
  reviewHighlightText: { fontSize: 14, fontWeight: "600", color: T.textPrimary, lineHeight: 20 },
  heatmapCard: { backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 16 },
  heatmapHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  heatmapTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary },
  heatmapSub: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  heatmapBadge: { backgroundColor: T.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  heatmapBadgeGood: { backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accentBorder },
  heatmapBadgeText: { fontSize: 13, fontWeight: "700", color: T.textMuted },
  heatmapBadgeTextGood: { color: T.accent },
  heatmapWeek: { flexDirection: "row", gap: 4, marginBottom: 4 },
  heatmapCell: { flex: 1, height: 26, borderRadius: 5 },
  heatmapCellToday: { borderWidth: 2, borderColor: T.accent },
  heatmapLegend: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, justifyContent: "flex-end" },
  heatmapLegendLabel: { fontSize: 10, color: T.textMuted },
  heatmapLegendDot: { width: 14, height: 14, borderRadius: 3 },

  supplementsBtn: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  supplementsIcon: { fontSize: 24 },
  supplementsTitle: { color: T.textPrimary, fontWeight: "600", fontSize: 14 },
  supplementsSub: { color: T.textSecondary, fontSize: 12, marginTop: 2 },
});
