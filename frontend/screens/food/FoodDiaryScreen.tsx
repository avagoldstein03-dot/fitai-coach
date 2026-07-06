import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealEntry {
  id: string;
  time: string;
  createdAt: string;
  foods: FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface DayData {
  date: string;
  meals: MealEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
}

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function mealTypeFromTime(timeStr: string, t: (key: string) => string): { label: string; emoji: string; color: string; bg: string } {
  const match = timeStr?.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return { label: t("food_diary.meal_snack"), emoji: "🫐", color: T.teal, bg: T.tealDark };
  let hour = parseInt(match[1], 10);
  const ampm = (match[3] ?? "").toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  if (hour < 10) return { label: t("food_diary.meal_breakfast"), emoji: "🌅", color: T.amber, bg: T.amberDark };
  if (hour < 14) return { label: t("food_diary.meal_lunch"), emoji: "☀️", color: T.accent, bg: T.accentDark };
  if (hour < 18) return { label: t("food_diary.meal_snack"), emoji: "🫐", color: T.teal, bg: T.tealDark };
  return { label: t("food_diary.meal_dinner"), emoji: "🌙", color: T.blue, bg: T.blueDark };
}

function labelDate(dateStr: string, t: (key: string) => string, locale: string): string {
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400_000));
  if (dateStr === today) return t("food_diary.today");
  if (dateStr === yesterday) return t("food_diary.yesterday");
  return new Date(dateStr).toLocaleDateString(locale, {
    weekday: "short", month: "short", day: "numeric",
  });
}

export default function FoodDiaryScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const { data: targets } = useQuery<{ dailyCaloricTarget: number; proteinTarget: number }>({
    queryKey: ["nutritionTargets"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/nutrition/targets`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["food-history", "diary"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/food/history?days=30&limit=200`);
      return res.data?.data as {
        stats: any;
        dailyData: DayData[];
        meals: { recent: MealEntry[]; count: number };
      };
    },
    staleTime: 30_000,
  });

  const { mutate: deleteMeal, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_URL}/api/food/history?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-history"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
    },
    onError: () => Alert.alert(t("common.error"), t("food_diary.error_delete")),
  });

  const allDays = data?.dailyData ?? [];
  const dayData = allDays.find((d) => d.date === selectedDate);

  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - i * 86400_000);
    return formatDate(d);
  });

  const handleDelete = (meal: MealEntry) => {
    Alert.alert(
      t("food_diary.delete_title"),
      t("food_diary.delete_msg", { calories: meal.calories }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: () => deleteMeal(meal.id) },
      ]
    );
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("food_diary.title")}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dateStrip}
      >
        {dateOptions.map((date) => {
          const hasData = allDays.some((d) => d.date === date);
          const isSelected = date === selectedDate;
          return (
            <TouchableOpacity
              key={date}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedDate(date); }}
              style={[
                s.dateChip,
                isSelected ? s.dateChipSelected : hasData ? s.dateChipHasData : s.dateChipEmpty,
              ]}
            >
              <Text style={[s.dateChipText, isSelected ? s.dateChipTextSelected : hasData ? s.dateChipTextHasData : s.dateChipTextEmpty]}>
                {labelDate(date, t, i18n.language)}
              </Text>
              {hasData && !isSelected && <View style={s.dateDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.accent} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : !dayData ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🍽️</Text>
            <Text style={s.emptyTitle}>{t("food_diary.no_meals")}</Text>
            <Text style={s.emptySub}>{t("food_diary.empty_sub")}</Text>
            <TouchableOpacity onPress={() => navigation.navigate("FoodScanner")} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>{t("food_diary.log_meal")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.dayContent}>
            <View style={s.totalsCard}>
              <Text style={s.totalsTitle}>{labelDate(selectedDate, t, i18n.language)} — {t("food_diary.meals_count", { count: dayData.mealCount })}</Text>
              <View style={s.macroRow}>
                {[
                  { label: t("food_diary.calories"), value: Math.round(dayData.totalCalories), unit: t("nutrition.kcal_suffix"), color: T.accent },
                  { label: t("food_diary.protein"),  value: Math.round(dayData.totalProtein),  unit: "g",    color: T.blue },
                  { label: t("food_diary.carbs"),    value: Math.round(dayData.totalCarbs),    unit: "g",    color: T.amber },
                  { label: t("food_diary.fat"),      value: Math.round(dayData.totalFat),      unit: "g",    color: T.red },
                ].map((macro) => (
                  <View key={macro.label} style={s.macroItem}>
                    <Text style={[s.macroValue, { color: macro.color }]}>{macro.value}</Text>
                    <Text style={s.macroUnit}>{macro.unit}</Text>
                    <Text style={s.macroLabel}>{macro.label}</Text>
                  </View>
                ))}
              </View>
              {targets && [
                { label: t("food_diary.calories"), current: dayData.totalCalories, target: targets.dailyCaloricTarget, color: T.accent },
                { label: t("food_diary.protein"),  current: dayData.totalProtein,  target: targets.proteinTarget,       color: T.blue },
              ].map((m) => (
                <View key={m.label} style={s.targetRow}>
                  <View style={s.targetTrack}>
                    <View style={[s.targetFill, { width: `${Math.min((m.current / m.target) * 100, 100)}%` as any, backgroundColor: m.color }]} />
                  </View>
                  <Text style={s.targetText}>{Math.round(m.current)} / {m.target}</Text>
                </View>
              ))}
            </View>

            {dayData.meals.map((meal) => {
              const mt = mealTypeFromTime(meal.time, t);
              return (
                <View key={meal.id} style={s.mealCard}>
                  <View style={s.mealHeader}>
                    <View style={s.mealHeaderLeft}>
                      <View style={[s.mealTypeBadge, { backgroundColor: mt.bg, borderColor: mt.color + "60" }]}>
                        <Text style={s.mealTypeEmoji}>{mt.emoji}</Text>
                        <Text style={[s.mealTypeLabel, { color: mt.color }]}>{mt.label}</Text>
                      </View>
                      <Text style={s.mealTime}>{meal.time}</Text>
                    </View>
                    <View style={s.mealHeaderRight}>
                      <Text style={s.mealCalories}>{Math.round(meal.calories)} {t("nutrition.kcal_suffix")}</Text>
                      <TouchableOpacity onPress={() => handleDelete(meal)} disabled={isDeleting} style={s.deleteBtn} accessibilityLabel={t("food_diary.delete_title")} accessibilityRole="button">
                        <Text style={s.deleteIcon}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                {meal.foods.map((food) => (
                  <View key={food.id} style={s.foodRow}>
                    <Text style={s.foodName}>{food.name}</Text>
                    <Text style={s.foodMacros}>{Math.round(food.calories)} {t("nutrition.kcal_suffix")} · {Math.round(food.protein)}g {t("food_diary.abbr_protein")}</Text>
                  </View>
                ))}

                <View style={s.mealMacroRow}>
                  {[
                    { label: t("food_diary.abbr_protein"), value: meal.protein, color: T.blue },
                    { label: t("food_diary.abbr_carbs"),   value: meal.carbs,   color: T.amber },
                    { label: t("food_diary.abbr_fat"),     value: meal.fat,     color: T.red },
                  ].map((m) => (
                    <Text key={m.label} style={[s.mealMacro, { color: m.color }]}>
                      {m.label}: {Math.round(m.value)}g
                    </Text>
                  ))}
                </View>
              </View>
              );
            })}

            <TouchableOpacity
              onPress={() => navigation.navigate("FoodScanner")}
              style={s.addMealBtn}
            >
              <Text style={s.addMealBtnText}>{t("food_diary.log_another")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12 },
  backBtn: { marginRight: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary },
  dateStrip: { paddingHorizontal: 16, paddingBottom: 8 },
  dateChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  dateChipSelected: { backgroundColor: T.accent, borderColor: T.accent },
  dateChipHasData: { backgroundColor: T.surface, borderColor: T.border },
  dateChipEmpty: { backgroundColor: T.surface, borderColor: T.border },
  dateChipText: { fontSize: 13, fontWeight: "600" },
  dateChipTextSelected: { color: "#000" },
  dateChipTextHasData: { color: T.textPrimary },
  dateChipTextEmpty: { color: T.textMuted },
  dateDot: { width: 5, height: 5, backgroundColor: T.accent, borderRadius: 3, alignSelf: "center", marginTop: 4 },
  centered: { paddingVertical: 80, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: T.textPrimary, textAlign: "center", marginBottom: 8 },
  emptySub: { fontSize: 13, color: T.textSecondary, textAlign: "center", marginBottom: 24 },
  primaryBtn: { backgroundColor: T.accent, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  dayContent: { paddingHorizontal: 20 },
  totalsCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  totalsTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 14 },
  macroRow: { flexDirection: "row", justifyContent: "space-between" },
  macroItem: { alignItems: "center" },
  macroValue: { fontSize: 18, fontWeight: "700" },
  macroUnit: { fontSize: 11, color: T.textMuted },
  macroLabel: { fontSize: 11, color: T.textSecondary },
  mealCard: {
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 10,
  },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  mealTime: { fontSize: 11, color: T.textMuted },
  mealCount: { fontSize: 14, fontWeight: "600", color: T.textPrimary, marginTop: 2 },
  mealHeaderRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  mealCalories: { color: T.accent, fontWeight: "700", fontSize: 14 },
  deleteBtn: { padding: 4 },
  deleteIcon: { fontSize: 16 },
  foodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  foodName: { fontSize: 13, color: T.textPrimary, flex: 1, marginRight: 8 },
  foodMacros: { fontSize: 12, color: T.textMuted },
  mealMacroRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  mealMacro: { fontSize: 12, fontWeight: "600" },
  addMealBtn: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  addMealBtnText: { color: T.accent, fontWeight: "600" },
  targetRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  targetTrack: { flex: 1, height: 5, backgroundColor: T.surface2, borderRadius: 3, overflow: "hidden" },
  targetFill: { height: "100%", borderRadius: 3 },
  targetText: { fontSize: 11, color: T.textMuted, minWidth: 70, textAlign: "right" },
  mealHeaderLeft: { flex: 1, gap: 4 },
  mealTypeBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  mealTypeEmoji: { fontSize: 12 },
  mealTypeLabel: { fontSize: 11, fontWeight: "700" },
});
