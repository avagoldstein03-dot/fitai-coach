import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Svg, Circle, G } from "react-native-svg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useUpgradeGate, isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import { posthog, Events } from "@/lib/analytics";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface NutritionTargets {
  dailyCaloricTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  waterTarget: number;
  tdee: number;
  goal: string;
  mealTimings: Array<{ meal: string; time: string; caloriePercent: number }>;
}

interface MealPlanMeal {
  name: string;
  foods: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealPlanDay {
  day: string;
  meals: MealPlanMeal[];
}

interface NutritionPlan {
  id: string;
  dailyCaloricTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  mealPlan?: { rawText: string; days?: MealPlanDay[] };
}

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const { t } = useTranslation();
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const offset = circumference * (1 - pct);
  const isOver = consumed > target;
  const arcColor = isOver ? T.red : T.accent;
  const remaining = target - consumed;

  return (
    <View style={s.ringWrapper}>
      <View style={s.ringContainer}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={radius} stroke={T.surface2} strokeWidth={strokeWidth} fill="none" />
          <G transform={`rotate(-90, ${cx}, ${cy})`}>
            <Circle
              cx={cx} cy={cy} r={radius}
              stroke={arcColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View style={s.ringCenter}>
          <Text style={s.ringCalories}>{consumed}</Text>
          <Text style={s.ringEaten}>{t("nutrition.ring_eaten")}</Text>
        </View>
      </View>
      <View style={s.ringStats}>
        <View style={s.ringStat}>
          <Text style={s.ringStatValue}>{target}</Text>
          <Text style={s.ringStatLabel}>{t("nutrition.ring_goal")}</Text>
        </View>
        <View style={s.ringStatDivider} />
        <View style={s.ringStat}>
          <Text style={[s.ringStatValue, { color: isOver ? T.red : T.accentMuted }]}>{Math.abs(remaining)}</Text>
          <Text style={s.ringStatLabel}>{isOver ? t("nutrition.ring_over") : t("nutrition.ring_remaining")}</Text>
        </View>
      </View>
    </View>
  );
}

function MacroBar({ label, current, target, color }: {
  label: string; current: number; target: number; color: string;
}) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <View style={s.macroBarWrapper}>
      <View style={s.macroBarHeader}>
        <Text style={s.macroBarLabel}>{label}</Text>
        <Text style={[s.macroBarValue, { color }]}>{Math.round(current)}g <Text style={s.macroBarTarget}>/ {target}g</Text></Text>
      </View>
      <View style={s.macroTrack}>
        <View style={[s.macroFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function NutritionScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const { presentUpgrade } = useUpgradeGate();
  const [activeTab, setActiveTab] = useState<"targets" | "plan">("targets");
  const [selectedPlanDay, setSelectedPlanDay] = useState(0);

  const { data: targets, isLoading: loadingTargets, refetch: refetchTargets, isRefetching } =
    useQuery<NutritionTargets>({
      queryKey: ["nutritionTargets"],
      queryFn: async () => {
        const res = await axios.get(`${API_URL}/api/nutrition/targets`);
        return res.data.data;
      },
    });

  const { data: planData, isLoading: loadingPlan, refetch: refetchPlan } =
    useQuery<{ plan: NutritionPlan; mealPlanText?: string }>({
      queryKey: ["nutritionPlan"],
      queryFn: async () => {
        const res = await axios.get(`${API_URL}/api/nutrition/plan`);
        return res.data.data;
      },
      retry: false,
    });

  const todayStr = new Date().toISOString().split("T")[0];
  const { data: todayFoodData } = useQuery<{ dailyData: Array<{ date: string; totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number }> }>({
    queryKey: ["food-history", "nutrition-today"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/food/history?days=1&limit=10`);
      return res.data?.data;
    },
    staleTime: 30_000,
  });
  const todayMacros = todayFoodData?.dailyData?.find((d) => d.date === todayStr);

  const { mutate: generatePlan, isPending: isGenerating } = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`${API_URL}/api/nutrition/plan`);
      return res.data;
    },
    onSuccess: () => {
      posthog.capture(Events.MEAL_PLAN_GENERATED);
      queryClient.invalidateQueries({ queryKey: ["nutritionPlan"] });
      Alert.alert(t("nutrition.plan_ready_title"), t("nutrition.plan_ready_msg"));
    },
    onError: (err: any) => {
      if (isPremiumRequiredError(err)) { presentUpgrade(); return; }
      Alert.alert(t("common.error"), err.response?.data?.message || t("nutrition.error_generate"));
    },
  });

  if (loadingTargets && !targets) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => { refetchTargets(); refetchPlan(); }}
          tintColor={T.accent}
        />
      }
    >
      <View style={s.container}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>{t("nutrition.title")}</Text>
            <Text style={s.subtitle}>{t("nutrition.subtitle")}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("FoodDiary")} style={s.diaryBtn}>
            <Text style={s.diaryBtnText}>📖  {t("nutrition.diary")}</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={s.tabBar}>
          {(["targets", "plan"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab); }}
              style={[s.tab, activeTab === tab && s.tabActive]}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === "targets" ? t("nutrition.daily_targets") : t("nutrition.meal_plan")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Targets Tab ── */}
        {activeTab === "targets" && targets && (
          <>
            {/* Calorie ring */}
            <View style={s.calorieCard}>
              <CalorieRing
                consumed={todayMacros?.totalCalories ?? 0}
                target={targets.dailyCaloricTarget}
              />
              {todayMacros && (() => {
                const pCals = todayMacros.totalProtein * 4;
                const cCals = todayMacros.totalCarbs * 4;
                const fCals = todayMacros.totalFat * 9;
                const sum = pCals + cCals + fCals || 1;
                const splits = [
                  { label: t("nutrition.protein"), pct: Math.round((pCals / sum) * 100), color: T.blue },
                  { label: t("nutrition.carbs"),   pct: Math.round((cCals / sum) * 100), color: T.amber },
                  { label: t("nutrition.fats"),    pct: Math.round((fCals / sum) * 100), color: T.red },
                ];
                return (
                  <View style={s.macroSplitCard}>
                    {splits.map((m, i) => (
                      <React.Fragment key={m.label}>
                        {i > 0 && <View style={s.macroSplitDivider} />}
                        <View style={s.macroSplitItem}>
                          <View style={[s.macroSplitDot, { backgroundColor: m.color }]} />
                          <Text style={[s.macroSplitPct, { color: m.color }]}>{m.pct}%</Text>
                          <Text style={s.macroSplitLabel}>{m.label}</Text>
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                );
              })()}
              <Text style={s.calorieUnit}>{t("nutrition.tdee", { tdee: targets.tdee })}</Text>
              <View style={s.goalChip}>
                <Text style={s.goalChipText}>{targets.goal.replace(/_/g, " ")}</Text>
              </View>
            </View>

            {/* Macro targets */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t("nutrition.macros")}</Text>
              <MacroBar label={t("nutrition.protein")} current={todayMacros?.totalProtein ?? 0} target={targets.proteinTarget} color={T.blue} />
              <MacroBar label={t("nutrition.carbs")}   current={todayMacros?.totalCarbs ?? 0}   target={targets.carbsTarget}   color={T.amber} />
              <MacroBar label={t("nutrition.fats")}    current={todayMacros?.totalFat ?? 0}     target={targets.fatsTarget}    color={T.red} />
              <View style={s.waterRow}>
                <Text style={s.waterLabel}>💧 {t("nutrition.water")}</Text>
                <Text style={s.waterValue}>{t("nutrition.water_value", { amount: (targets.waterTarget / 1000).toFixed(1) })}</Text>
              </View>
            </View>

            {/* Meal timing */}
            {targets.mealTimings?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>{t("nutrition.meal_timing")}</Text>
                {targets.mealTimings.map((mt, i) => (
                  <View key={i} style={[s.timingRow, i < targets.mealTimings.length - 1 && s.timingRowBorder]}>
                    <View>
                      <Text style={s.timingMeal}>{mt.meal}</Text>
                      <Text style={s.timingTime}>{mt.time}</Text>
                    </View>
                    <Text style={s.timingCal}>
                      ~{Math.round((targets.dailyCaloricTarget * mt.caloriePercent) / 100)} {t("nutrition.kcal_suffix")}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Plan Tab ── */}
        {activeTab === "plan" && (
          <>
            <TouchableOpacity
              style={[s.generateBtn, isGenerating && { opacity: 0.7 }]}
              onPress={() => generatePlan()}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              {isGenerating
                ? <ActivityIndicator color={T.accent} />
                : <Text style={s.generateBtnText}>
                    {planData ? t("nutrition.regenerate") : t("nutrition.generate")}
                  </Text>
              }
            </TouchableOpacity>

            {planData?.plan && (
              <>
                <TouchableOpacity onPress={() => navigation.navigate("ShoppingList")} style={s.shoppingBtn} activeOpacity={0.8}>
                  <Text style={s.shoppingEmoji}>🛒</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.shoppingTitle}>{t("nutrition.shopping_list")}</Text>
                    <Text style={s.shoppingSub}>{t("nutrition.shopping_sub")}</Text>
                  </View>
                  <Text style={s.shoppingArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate("ProductScan")} style={s.shoppingBtn} activeOpacity={0.8}>
                  <Text style={s.shoppingEmoji}>🔍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.shoppingTitle}>{t("nutrition.scan_product")}</Text>
                    <Text style={s.shoppingSub}>{t("nutrition.scan_product_sub")}</Text>
                  </View>
                  <Text style={s.shoppingArrow}>›</Text>
                </TouchableOpacity>
              </>
            )}

            {loadingPlan ? (
              <View style={s.centered}><ActivityIndicator color={T.accent} /></View>
            ) : planData?.plan ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>{t("nutrition.plan_title")}</Text>

                {/* Macro summary */}
                <View style={s.planMacroRow}>
                  {[
                    { label: t("nutrition.calories"), value: `${planData.plan.dailyCaloricTarget}`, color: T.accent },
                    { label: t("nutrition.protein"),  value: `${planData.plan.proteinTarget}g`,     color: T.blue },
                    { label: t("nutrition.carbs"),    value: `${planData.plan.carbsTarget}g`,       color: T.amber },
                    { label: t("nutrition.fats"),     value: `${planData.plan.fatsTarget}g`,        color: T.red },
                  ].map((m) => (
                    <View key={m.label} style={s.planMacroItem}>
                      <Text style={[s.planMacroValue, { color: m.color }]}>{m.value}</Text>
                      <Text style={s.planMacroLabel}>{m.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Day selector */}
                {planData.plan.mealPlan?.days?.length ? (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      <View style={s.dayRow}>
                        {planData.plan.mealPlan.days.map((d, i) => (
                          <TouchableOpacity
                            key={d.day}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedPlanDay(i); }}
                            style={[s.dayChip, selectedPlanDay === i && s.dayChipActive]}
                          >
                            <Text style={[s.dayChipText, selectedPlanDay === i && s.dayChipTextActive]}>
                              {d.day}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <View style={{ gap: 10 }}>
                      {planData.plan.mealPlan.days[selectedPlanDay]?.meals.map((meal, i) => (
                        <View key={i} style={s.mealItem}>
                          <View style={s.mealItemHeader}>
                            <Text style={s.mealItemName}>{meal.name}</Text>
                            <Text style={s.mealItemCal}>{Math.round(meal.calories)} {t("nutrition.kcal_suffix")}</Text>
                          </View>
                          {meal.foods.map((food, j) => (
                            <Text key={j} style={s.mealItemFood}>· {food}</Text>
                          ))}
                          <View style={s.mealItemMacros}>
                            <Text style={[s.mealMacroText, { color: T.blue }]}>{t("food_diary.abbr_protein")} {Math.round(meal.protein)}g</Text>
                            <Text style={[s.mealMacroText, { color: T.amber }]}>{t("food_diary.abbr_carbs")} {Math.round(meal.carbs)}g</Text>
                            <Text style={[s.mealMacroText, { color: T.red }]}>{t("food_diary.abbr_fat")} {Math.round(meal.fat)}g</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                ) : planData.plan.mealPlan?.rawText ? (
                  <Text style={s.rawPlanText}>{planData.plan.mealPlan.rawText}</Text>
                ) : null}
              </View>
            ) : (
              <View style={s.emptyCard}>
                <Text style={s.emptyIcon}>🥗</Text>
                <Text style={s.emptyTitle}>{t("nutrition.empty_title")}</Text>
                <Text style={s.emptySub}>{t("nutrition.empty_sub")}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loader: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  centered: { paddingVertical: 32, alignItems: "center" },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48 },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontSize: 30, fontWeight: "800", color: T.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: T.textSecondary, marginTop: 2 },
  diaryBtn: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  diaryBtnText: { color: T.accent, fontSize: 13, fontWeight: "600" },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: T.border,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accentBorder },
  tabText: { fontSize: 13, fontWeight: "600", color: T.textSecondary },
  tabTextActive: { color: T.accent },

  // Calorie Hero
  calorieCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 24,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  calorieCaption: { fontSize: 12, color: T.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  calorieNumber: { fontSize: 56, fontWeight: "800", color: T.accent, letterSpacing: -2, lineHeight: 60 },
  calorieUnit: { fontSize: 13, color: T.textSecondary, marginTop: 4, marginBottom: 12 },
  goalChip: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  goalChipText: { color: T.accentMuted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

  // Generic Card
  card: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: T.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 16,
  },

  // Macro Bar
  macroBarWrapper: { marginBottom: 14 },
  macroBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  macroBarLabel: { fontSize: 13, color: T.textSecondary },
  macroBarValue: { fontSize: 13, fontWeight: "700" },
  macroBarTarget: { fontWeight: "400", color: T.textMuted },
  macroTrack: { height: 6, backgroundColor: T.surface2, borderRadius: 3, overflow: "hidden" },
  macroFill: { height: 6, borderRadius: 3 },

  // Water
  waterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: T.border,
    marginTop: 2,
  },
  waterLabel: { fontSize: 14, color: T.textSecondary },
  waterValue: { fontSize: 14, fontWeight: "700", color: T.blue },

  // Timing
  timingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  timingRowBorder: { borderBottomWidth: 1, borderColor: T.border },
  timingMeal: { fontSize: 14, fontWeight: "600", color: T.textPrimary, marginBottom: 2 },
  timingTime: { fontSize: 12, color: T.textSecondary },
  timingCal: { fontSize: 13, color: T.textSecondary },

  // Generate
  generateBtn: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  generateBtnText: { color: T.accent, fontSize: 16, fontWeight: "800" },

  // Shopping
  shoppingBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 14,
  },
  shoppingEmoji: { fontSize: 24 },
  shoppingTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 2 },
  shoppingSub: { fontSize: 12, color: T.textSecondary },
  shoppingArrow: { fontSize: 22, color: T.textMuted },

  // Plan macros summary
  planMacroRow: { flexDirection: "row", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: T.border },
  planMacroItem: { flex: 1, alignItems: "center" },
  planMacroValue: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  planMacroLabel: { fontSize: 10, color: T.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  // Day chips
  dayRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  dayChip: {
    backgroundColor: T.surface2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dayChipActive: { backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accent },
  dayChipText: { fontSize: 13, color: T.textSecondary, fontWeight: "600" },
  dayChipTextActive: { color: T.accent },

  // Meal items
  mealItem: {
    backgroundColor: T.surface2,
    borderRadius: 14,
    padding: 14,
  },
  mealItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  mealItemName: { fontSize: 14, fontWeight: "700", color: T.textPrimary },
  mealItemCal: { fontSize: 13, color: T.accent, fontWeight: "700" },
  mealItemFood: { fontSize: 13, color: T.textSecondary, marginBottom: 2 },
  mealItemMacros: { flexDirection: "row", gap: 14, marginTop: 8 },
  mealMacroText: { fontSize: 12, fontWeight: "600" },

  // Raw text / empty
  rawPlanText: { fontSize: 13, color: T.textSecondary, lineHeight: 22 },
  emptyCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 40,
    alignItems: "center",
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: T.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 14, color: T.textSecondary, textAlign: "center" },

  // Macro split
  macroSplitCard: {
    flexDirection: "row",
    backgroundColor: T.surface2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
    alignSelf: "stretch",
  },
  macroSplitItem: { flex: 1, alignItems: "center", gap: 4 },
  macroSplitDivider: { width: 1, backgroundColor: T.border },
  macroSplitDot: { width: 8, height: 8, borderRadius: 4 },
  macroSplitPct: { fontSize: 16, fontWeight: "800" },
  macroSplitLabel: { fontSize: 10, color: T.textMuted, fontWeight: "600" },

  // Calorie ring
  ringWrapper: { alignItems: "center", marginBottom: 20 },
  ringContainer: { position: "relative" },
  ringCenter: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  ringCalories: { fontSize: 36, fontWeight: "800", color: T.textPrimary, letterSpacing: -1 },
  ringEaten: { fontSize: 11, color: T.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  ringStats: { flexDirection: "row", alignItems: "center", gap: 28, marginTop: 14 },
  ringStat: { alignItems: "center" },
  ringStatValue: { fontSize: 20, fontWeight: "800", color: T.textSecondary },
  ringStatLabel: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  ringStatDivider: { width: 1, height: 28, backgroundColor: T.border },
});
