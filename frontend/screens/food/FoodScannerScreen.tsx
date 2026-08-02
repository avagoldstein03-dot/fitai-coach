import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface MealHistoryResponse {
  stats: {
    periodDays: number;
    totalMeals: number;
    totalCalories: number;
    averageCaloriesPerDay: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    averageProteinPerMeal: number;
  };
  dailyData: Array<{
    date: string;
    meals: Array<{
      id: string;
      mealType: string;
      time: string;
      foods: Array<{
        id: string;
        name: string;
        quantity: number;
        unit: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
        sugar?: number;
        saturatedFat?: number;
        sodium?: number;
        cholesterol?: number;
      }>;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
    totalCalories: number;
    totalProtein: number;
    mealCount: number;
  }>;
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

interface ManualFoodItem {
  foodName: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  saturatedFat: string;
  sodium: string;
  cholesterol: string;
}

const EMPTY_ITEM: ManualFoodItem = {
  foodName: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  sugar: "",
  saturatedFat: "",
  sodium: "",
  cholesterol: "",
};

export default function FoodScannerScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [manualMealType, setManualMealType] = useState<typeof MEAL_TYPES[number]>("snack");
  const [manualItems, setManualItems] = useState<ManualFoodItem[]>([]);
  const [currentItem, setCurrentItem] = useState<ManualFoodItem>(EMPTY_ITEM);
  const [showFullDetail, setShowFullDetail] = useState(false);
  const [showReLogModal, setShowReLogModal] = useState(false);
  const [reLogMealType, setReLogMealType] = useState<typeof MEAL_TYPES[number]>("snack");
  const [pendingReLog, setPendingReLog] = useState<{ name: string; calories: number; protein: number; carbs: number; fat: number } | null>(null);

  const { data: historyData, refetch: refetchHistory, isRefetching: isRefetchingHistory } = useQuery({
    queryKey: ["mealHistory"],
    queryFn: async () => {
      const response = await axios.get<{ data: MealHistoryResponse }>(
        `${API_URL}/api/food/history?days=7`
      );
      return response.data.data;
    },
  });

  const addItemToList = () => {
    if (!currentItem.foodName.trim() || !currentItem.calories) {
      Alert.alert(t("food_scanner.missing_info"), t("food_scanner.missing_info_msg"));
      return;
    }
    setManualItems((prev) => [...prev, currentItem]);
    setCurrentItem(EMPTY_ITEM);
    setShowFullDetail(false);
  };

  const removeItemFromList = (index: number) => {
    setManualItems((prev) => prev.filter((_, i) => i !== index));
  };

  const manualTotals = manualItems.reduce(
    (sum, item) => ({
      calories: sum.calories + Number(item.calories || 0),
      protein: sum.protein + Number(item.protein || 0),
      carbs: sum.carbs + Number(item.carbs || 0),
      fat: sum.fat + Number(item.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const { mutate: logManually, isPending: isLoggingManually } = useMutation({
    mutationFn: async () => {
      const payload = {
        mealType: manualMealType,
        items: manualItems.map((item) => ({
          foodName: item.foodName,
          calories: Number(item.calories || 0),
          protein: Number(item.protein || 0),
          carbs: Number(item.carbs || 0),
          fat: Number(item.fat || 0),
          fiber: Number(item.fiber || 0),
          sugar: item.sugar ? Number(item.sugar) : undefined,
          saturatedFat: item.saturatedFat ? Number(item.saturatedFat) : undefined,
          sodium: item.sodium ? Number(item.sodium) : undefined,
          cholesterol: item.cholesterol ? Number(item.cholesterol) : undefined,
        })),
      };
      const response = editingMealId
        ? await axios.patch(`${API_URL}/api/food/history?id=${editingMealId}`, payload)
        : await axios.post(`${API_URL}/api/food/manual`, payload);
      return response.data;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const wasEditing = !!editingMealId;
      setManualModalVisible(false);
      setManualItems([]);
      setCurrentItem(EMPTY_ITEM);
      setEditingMealId(null);
      queryClient.invalidateQueries({ queryKey: ["mealHistory"] });
      queryClient.invalidateQueries({ queryKey: ["food-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert(
        wasEditing ? t("food_scanner.updated_title") : t("food_scanner.logged_title"),
        wasEditing ? t("food_scanner.updated_msg") : t("food_scanner.logged_msg")
      );
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || t("food_scanner.error_log");
      Alert.alert(t("common.error"), message);
    },
  });

  const { mutate: deleteMeal, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_URL}/api/food/history?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealHistory"] });
      queryClient.invalidateQueries({ queryKey: ["food-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => Alert.alert(t("common.error"), t("food_diary.error_delete")),
  });

  const handleEditMeal = (meal: {
    id: string;
    mealType: string;
    foods: Array<{
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      sugar?: number;
      saturatedFat?: number;
      sodium?: number;
      cholesterol?: number;
    }>;
  }) => {
    setEditingMealId(meal.id);
    setManualMealType(
      (MEAL_TYPES as readonly string[]).includes(meal.mealType)
        ? (meal.mealType as typeof MEAL_TYPES[number])
        : "snack"
    );
    setManualItems(
      meal.foods.map((f) => ({
        foodName: f.name,
        calories: String(f.calories ?? ""),
        protein: String(f.protein ?? ""),
        carbs: String(f.carbs ?? ""),
        fat: String(f.fat ?? ""),
        fiber: String(f.fiber ?? ""),
        sugar: f.sugar != null ? String(f.sugar) : "",
        saturatedFat: f.saturatedFat != null ? String(f.saturatedFat) : "",
        sodium: f.sodium != null ? String(f.sodium) : "",
        cholesterol: f.cholesterol != null ? String(f.cholesterol) : "",
      }))
    );
    setCurrentItem(EMPTY_ITEM);
    setShowFullDetail(false);
    setManualModalVisible(true);
  };

  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number }> = [];
    for (const day of historyData?.dailyData?.slice(1) ?? []) {
      for (const meal of day.meals) {
        const key = meal.foods.map((f) => f.name).join("+");
        if (!seen.has(key) && meal.foods.length > 0) {
          seen.add(key);
          items.push({
            name: meal.foods.length === 1 ? meal.foods[0].name : meal.foods.map((f) => f.name).join(", "),
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
          });
        }
        if (items.length >= 3) break;
      }
      if (items.length >= 3) break;
    }
    return items;
  }, [historyData]);

  const { mutate: reLogFood, isPending: isReLogging } = useMutation({
    mutationFn: async (item: { name: string; calories: number; protein: number; carbs: number; fat: number }) => {
      return axios.post(`${API_URL}/api/food/manual`, {
        mealType: reLogMealType,
        items: [{ foodName: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, fiber: 0 }],
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowReLogModal(false);
      setPendingReLog(null);
      queryClient.invalidateQueries({ queryKey: ["mealHistory"] });
      queryClient.invalidateQueries({ queryKey: ["food-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      refetchHistory();
    },
    onError: (error: any) => {
      Alert.alert(t("common.error"), error.response?.data?.message || t("food_scanner.error_log"));
    },
  });

  const { data: nutritionTargets } = useQuery<{ dailyCaloricTarget: number; proteinTarget: number; carbsTarget: number; fatsTarget: number }>({
    queryKey: ["nutritionTargets"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/nutrition/targets`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const todaysData = historyData?.dailyData?.[0];
  const stats = historyData?.stats;

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetchingHistory} onRefresh={refetchHistory} tintColor={T.accent} />}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("food_scanner.title")}</Text>
          <Text style={styles.subtitle}>{t("food_scanner.subtitle")}</Text>
        </View>

        {/* Today's Calorie Ring */}
        {todaysData && (
          <View style={styles.calorieCard}>
            <View style={styles.calorieRow}>
              <View style={styles.calorieMain}>
                <Text style={styles.calorieNumber}>{todaysData.totalCalories}</Text>
                <Text style={styles.calorieLabel}>{t("food_scanner.kcal_today")}</Text>
              </View>
              <View style={styles.macroRow}>
                <View style={styles.macroItem}>
                  <Text style={styles.macroValueBlue}>{Math.round(todaysData.totalProtein)}g</Text>
                  <Text style={styles.macroLabel}>{t("food_scanner.protein")}</Text>
                </View>
                <View style={styles.macroDivider} />
                <View style={styles.macroItem}>
                  <Text style={styles.macroValueOrange}>
                    {Math.round(todaysData.meals.reduce((s, m) => s + (m.carbs ?? 0), 0))}g
                  </Text>
                  <Text style={styles.macroLabel}>{t("food_scanner.carbs")}</Text>
                </View>
                <View style={styles.macroDivider} />
                <View style={styles.macroItem}>
                  <Text style={styles.macroValueYellow}>
                    {Math.round(todaysData.meals.reduce((s, m) => s + (m.fat ?? 0), 0))}g
                  </Text>
                  <Text style={styles.macroLabel}>{t("food_scanner.fat")}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Scan Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate("LiveFoodScan")}
          style={styles.scanButton}
          activeOpacity={0.85}
        >
          <View style={styles.scanIdle}>
            <Text style={styles.scanIcon}>📸</Text>
            <Text style={styles.scanLabel}>{t("food_scanner.scan_label")}</Text>
            <Text style={styles.scanSublabel}>{t("food_scanner.scan_sub")}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setEditingMealId(null); setManualModalVisible(true); }}
          style={styles.manualEntryLink}
        >
          <Text style={styles.manualEntryLinkText}>{t("food_scanner.enter_manually")}</Text>
        </TouchableOpacity>

        {/* Quick Re-Log */}
        {recentFoods.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>{t("food_scanner.log_again")}</Text>
            {recentFoods.map((food, i) => (
              <TouchableOpacity
                key={i}
                style={styles.recentItem}
                onPress={() => { setPendingReLog(food); setReLogMealType("snack"); setShowReLogModal(true); }}
                activeOpacity={0.75}
              >
                <View style={styles.recentItemLeft}>
                  <Text style={styles.recentItemName} numberOfLines={1}>{food.name}</Text>
                  <Text style={styles.recentItemMacros}>
                    {food.calories} {t("nutrition.kcal_suffix")} · {t("food_diary.abbr_protein")} {Math.round(food.protein)}g · {t("food_diary.abbr_carbs")} {Math.round(food.carbs)}g · {t("food_diary.abbr_fat")} {Math.round(food.fat)}g
                  </Text>
                </View>
                <View style={styles.recentAddBtn}>
                  <Text style={styles.recentAddBtnText}>{t("food_scanner.add_recent")}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Today's Meals */}
        {todaysData && todaysData.meals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("food_scanner.todays_meals")}</Text>
            {todaysData.meals.map((meal) => (
              <SwipeToDeleteRow
                key={meal.id}
                onDelete={() => deleteMeal(meal.id)}
                deleteLabel={t("common.delete")}
                disabled={isDeleting}
                borderRadius={16}
              >
                <View style={[styles.mealCard, styles.mealCardWrapper]}>
                  <View style={styles.mealCardHeader}>
                    <Text style={styles.mealTime}>{meal.time}</Text>
                    <View style={styles.mealHeaderRight}>
                      <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
                      <TouchableOpacity
                        onPress={() => handleEditMeal(meal)}
                        style={styles.mealDeleteBtn}
                        accessibilityLabel={t("common.edit")}
                        accessibilityRole="button"
                      >
                        <Text style={styles.mealDeleteIcon}>✎</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {meal.foods.map((food, j) => (
                    <Text key={j} style={styles.mealFood}>· {food.name}</Text>
                  ))}
                  <View style={styles.mealMacros}>
                    <Text style={styles.mealMacroText}>P {meal.protein}g</Text>
                    <Text style={styles.mealMacroText}>C {meal.carbs}g</Text>
                    <Text style={styles.mealMacroText}>F {meal.fat}g</Text>
                  </View>
                </View>
              </SwipeToDeleteRow>
            ))}
          </View>
        )}

        {/* What to eat next */}
        {todaysData && nutritionTargets && (() => {
          const calLeft = nutritionTargets.dailyCaloricTarget - todaysData.totalCalories;
          const protLeft = nutritionTargets.proteinTarget - Math.round(todaysData.totalProtein);
          const carbLeft = nutritionTargets.carbsTarget - Math.round(todaysData.meals.reduce((s, m) => s + (m.carbs ?? 0), 0));
          const fatLeft = nutritionTargets.fatsTarget - Math.round(todaysData.meals.reduce((s, m) => s + (m.fat ?? 0), 0));
          if (calLeft <= 0) return null;

          const focus = protLeft > carbLeft && protLeft > fatLeft
            ? { label: t("food_scanner.protein"), value: protLeft, unit: "g", color: T.blue }
            : carbLeft > fatLeft
              ? { label: t("food_scanner.carbs"), value: carbLeft, unit: "g", color: T.amber }
              : { label: t("food_scanner.fat"), value: fatLeft, unit: "g", color: T.red };

          return (
            <View style={styles.nextMealCard}>
              <View style={styles.nextMealHeader}>
                <Text style={styles.nextMealTitle}>{t("food_scanner.next_meal")}</Text>
                <View style={styles.nextMealCalBadge}>
                  <Text style={styles.nextMealCalBadgeText}>{t("food_scanner.kcal_left", { n: calLeft })}</Text>
                </View>
              </View>
              <View style={[styles.nextMealFocus, { borderColor: focus.color + "60" }]}>
                <Text style={styles.nextMealFocusLabel}>{t("food_scanner.prioritise")}</Text>
                <Text style={[styles.nextMealFocusMacro, { color: focus.color }]}>
                  {focus.label} — {Math.max(0, focus.value)}{focus.unit} remaining
                </Text>
              </View>
              <View style={styles.nextMealBars}>
                {[
                  { label: "P", left: protLeft, target: nutritionTargets.proteinTarget, color: T.blue },
                  { label: "C", left: carbLeft, target: nutritionTargets.carbsTarget, color: T.amber },
                  { label: "F", left: fatLeft, target: nutritionTargets.fatsTarget, color: T.red },
                ].map((m) => {
                  const pct = Math.min(Math.max(0, 1 - m.left / m.target), 1);
                  return (
                    <View key={m.label} style={styles.nextMealBarRow}>
                      <Text style={styles.nextMealBarLabel}>{m.label}</Text>
                      <View style={styles.nextMealBarTrack}>
                        <View style={[styles.nextMealBarFill, { width: `${pct * 100}%` as any, backgroundColor: m.color }]} />
                      </View>
                      <Text style={styles.nextMealBarVal}>{Math.max(0, m.left)}g</Text>
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.nextMealBtn} onPress={() => navigation.navigate("LiveFoodScan")} activeOpacity={0.85}>
                <Text style={styles.nextMealBtnText}>{t("food_scanner.log_next_meal")}</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Weekly Summary */}
        {stats && (
          <View style={styles.weekCard}>
            <Text style={styles.sectionTitle}>{t("food_scanner.weekly_summary")}</Text>
            <View style={styles.weekRow}>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatValue}>{stats.totalMeals}</Text>
                <Text style={styles.weekStatLabel}>{t("food_scanner.meals")}</Text>
              </View>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatValue}>{stats.averageCaloriesPerDay}</Text>
                <Text style={styles.weekStatLabel}>{t("food_scanner.avg_kcal")}</Text>
              </View>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatValue}>{Math.round(stats.totalProtein / 7)}g</Text>
                <Text style={styles.weekStatLabel}>{t("food_scanner.avg_protein")}</Text>
              </View>
            </View>
          </View>
        )}

        {!todaysData && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍽</Text>
            <Text style={styles.emptyTitle}>{t("food_scanner.empty_title")}</Text>
            <Text style={styles.emptySubtitle}>{t("food_scanner.empty_sub")}</Text>
          </View>
        )}
      </View>

      {/* Re-Log Modal */}
      <Modal visible={showReLogModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t("food_scanner.log_again")}</Text>
            {pendingReLog && (
              <View style={styles.reLogPreview}>
                <Text style={styles.reLogPreviewName} numberOfLines={2}>{pendingReLog.name}</Text>
                <Text style={styles.reLogPreviewMacros}>
                  {pendingReLog.calories} kcal · P {Math.round(pendingReLog.protein)}g · C {Math.round(pendingReLog.carbs)}g · F {Math.round(pendingReLog.fat)}g
                </Text>
              </View>
            )}
            <Text style={styles.fieldLabel}>{t("food_scanner.log_as")}</Text>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt}
                  onPress={() => setReLogMealType(mt)}
                  style={[styles.mealTypeChip, reLogMealType === mt && styles.mealTypeChipActive]}
                >
                  <Text style={[styles.mealTypeText, reLogMealType === mt && styles.mealTypeTextActive]}>{mt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReLogModal(false)}>
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logBtn, isReLogging && styles.logBtnDisabled]}
                onPress={() => pendingReLog && reLogFood(pendingReLog)}
                disabled={isReLogging}
              >
                <Text style={styles.logBtnText}>{isReLogging ? t("food_scanner.logging_btn") : t("food_scanner.log_it_btn")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Entry Modal */}
      <Modal visible={manualModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {editingMealId ? t("food_scanner.edit_title") : t("food_scanner.manual_title")}
            </Text>

            <Text style={styles.fieldLabel}>{t("food_scanner.meal_type")}</Text>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt}
                  onPress={() => setManualMealType(mt)}
                  style={[
                    styles.mealTypeChip,
                    manualMealType === mt && styles.mealTypeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.mealTypeText,
                      manualMealType === mt && styles.mealTypeTextActive,
                    ]}
                  >
                    {mt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {manualItems.length > 0 && (
                <View style={styles.itemsList}>
                  {manualItems.map((item, i) => (
                    <View key={i} style={styles.addedItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addedItemName}>{item.foodName}</Text>
                        <Text style={styles.addedItemMacros}>
                          {item.calories} kcal · P {item.protein}g · C {item.carbs}g · F {item.fat}g
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeItemFromList(i)}>
                        <Text style={styles.removeItem}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.mealTotalRow}>
                    <Text style={styles.mealTotalLabel}>{t("food_scanner.meal_total")}</Text>
                    <Text style={styles.mealTotalValue}>
                      {Math.round(manualTotals.calories)} kcal · P {Math.round(manualTotals.protein)}g
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.addItemBox}>
                <Text style={styles.addItemTitle}>{t("food_scanner.add_item")}</Text>
                <Text style={styles.fieldLabel}>{t("food_scanner.food_name")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("food_scanner.food_name_placeholder")}
                  placeholderTextColor={T.textMuted}
                  value={currentItem.foodName}
                  onChangeText={(text) => setCurrentItem((f) => ({ ...f, foodName: text }))}
                />
                <Text style={styles.fieldLabel}>{t("food_scanner.calories")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("food_scanner.calories_placeholder")}
                  placeholderTextColor={T.textMuted}
                  keyboardType="decimal-pad"
                  value={currentItem.calories}
                  onChangeText={(text) => setCurrentItem((f) => ({ ...f, calories: text }))}
                />
                <View style={styles.macroInputRow}>
                  {(["protein", "carbs", "fat"] as const).map((key) => (
                    <View key={key} style={{ flex: 1 }}>
                      <Text style={styles.fieldLabelSmall}>{key.charAt(0).toUpperCase() + key.slice(1)} (g)</Text>
                      <TextInput
                        style={styles.inputSmall}
                        placeholder="0"
                        placeholderTextColor={T.textMuted}
                        keyboardType="decimal-pad"
                        value={(currentItem as any)[key]}
                        onChangeText={(v) => setCurrentItem((f) => ({ ...f, [key]: v }))}
                      />
                    </View>
                  ))}
                </View>

                <TouchableOpacity onPress={() => setShowFullDetail((v) => !v)} style={styles.expandToggle}>
                  <Text style={styles.expandToggleText}>
                    {showFullDetail ? t("food_scanner.hide_extras") : t("food_scanner.add_extras")}
                  </Text>
                </TouchableOpacity>

                {showFullDetail && (
                  <View>
                    <View style={styles.macroInputRow}>
                      {(["fiber", "sugar"] as const).map((key) => (
                        <View key={key} style={{ flex: 1 }}>
                          <Text style={styles.fieldLabelSmall}>{key.charAt(0).toUpperCase() + key.slice(1)} (g)</Text>
                          <TextInput
                            style={styles.inputSmall}
                            placeholder="0"
                            placeholderTextColor={T.textMuted}
                            keyboardType="decimal-pad"
                            value={(currentItem as any)[key]}
                            onChangeText={(v) => setCurrentItem((f) => ({ ...f, [key]: v }))}
                          />
                        </View>
                      ))}
                    </View>
                    <View style={styles.macroInputRow}>
                      {(["saturatedFat", "cholesterol"] as const).map((key) => (
                        <View key={key} style={{ flex: 1 }}>
                          <Text style={styles.fieldLabelSmall}>
                            {key === "saturatedFat" ? t("food_scanner.sat_fat") : t("food_scanner.cholesterol")}
                          </Text>
                          <TextInput
                            style={styles.inputSmall}
                            placeholder="0"
                            placeholderTextColor={T.textMuted}
                            keyboardType="decimal-pad"
                            value={(currentItem as any)[key]}
                            onChangeText={(v) => setCurrentItem((f) => ({ ...f, [key]: v }))}
                          />
                        </View>
                      ))}
                    </View>
                    <Text style={styles.fieldLabel}>{t("food_scanner.sodium")}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor={T.textMuted}
                      keyboardType="decimal-pad"
                      value={currentItem.sodium}
                      onChangeText={(v) => setCurrentItem((f) => ({ ...f, sodium: v }))}
                    />
                  </View>
                )}

                <TouchableOpacity onPress={addItemToList} style={styles.addItemBtn}>
                  <Text style={styles.addItemBtnText}>{t("food_scanner.add_to_meal")}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setManualModalVisible(false);
                  setManualItems([]);
                  setCurrentItem(EMPTY_ITEM);
                  setShowFullDetail(false);
                  setEditingMealId(null);
                }}
              >
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logBtn, (isLoggingManually || manualItems.length === 0) && styles.logBtnDisabled]}
                onPress={() => logManually()}
                disabled={isLoggingManually || manualItems.length === 0}
              >
                {isLoggingManually ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.logBtnText}>
                    {editingMealId
                      ? t("food_scanner.save_changes_button")
                      : manualItems.length > 0
                        ? t("food_scanner.log_meal_count", { count: manualItems.length })
                        : t("food_scanner.log_meal_button")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },

  // Header
  header: { marginBottom: 24 },
  title: { fontSize: 30, fontWeight: "800", color: T.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: T.textSecondary, marginTop: 2 },

  // Calorie Card
  calorieCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 16,
  },
  calorieRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calorieMain: {},
  calorieNumber: { fontSize: 42, fontWeight: "800", color: T.textPrimary, letterSpacing: -1 },
  calorieLabel: { fontSize: 13, color: T.textSecondary, marginTop: 2 },
  macroRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  macroItem: { alignItems: "center" },
  macroValueBlue: { fontSize: 18, fontWeight: "700", color: T.blue },
  macroValueOrange: { fontSize: 18, fontWeight: "700", color: T.amber },
  macroValueYellow: { fontSize: 18, fontWeight: "700", color: T.accent },
  macroLabel: { fontSize: 11, color: T.textSecondary, marginTop: 2 },
  macroDivider: { width: 1, height: 28, backgroundColor: T.border },

  // Scan Button
  scanButton: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.accentBorder,
    padding: 32,
    marginBottom: 16,
    alignItems: "center",
  },
  scanIdle: { alignItems: "center" },
  scanIcon: { fontSize: 40, marginBottom: 10 },
  scanLabel: { fontSize: 18, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  scanSublabel: { fontSize: 13, color: T.textSecondary },
  manualEntryLink: { alignItems: "center", marginBottom: 16 },
  manualEntryLinkText: { color: T.accent, fontSize: 13, fontWeight: "600" },

  // Sections
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: T.textPrimary, marginBottom: 12 },

  // Meal Card
  mealCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
  },
  mealCardWrapper: { marginBottom: 8 },
  mealCardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  mealTime: { fontSize: 13, color: T.textSecondary, fontWeight: "600" },
  mealHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  mealCalories: { fontSize: 14, color: T.accent, fontWeight: "700" },
  mealDeleteBtn: { padding: 4 },
  mealDeleteIcon: { fontSize: 15 },
  mealFood: { fontSize: 13, color: T.textPrimary, marginBottom: 2 },
  mealMacros: { flexDirection: "row", gap: 12, marginTop: 8 },
  mealMacroText: { fontSize: 12, color: T.textMuted },

  // Week Card
  weekCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 16,
  },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekStat: { alignItems: "center", flex: 1 },
  weekStatValue: { fontSize: 22, fontWeight: "800", color: T.textPrimary },
  weekStatLabel: { fontSize: 12, color: T.textSecondary, marginTop: 2 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: T.textSecondary },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: T.border,
    padding: 24,
    maxHeight: "92%",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary, marginBottom: 20 },

  fieldLabel: { fontSize: 13, color: T.textSecondary, marginBottom: 6, fontWeight: "600" },
  fieldLabelSmall: { fontSize: 11, color: T.textSecondary, marginBottom: 4, fontWeight: "600" },

  mealTypeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  mealTypeChip: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  mealTypeChipActive: { backgroundColor: T.accentDark, borderColor: T.accent },
  mealTypeText: { fontSize: 12, color: T.textSecondary, fontWeight: "600", textTransform: "capitalize" },
  mealTypeTextActive: { color: T.accent },

  itemsList: { marginBottom: 16 },
  addedItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
    marginBottom: 6,
  },
  addedItemName: { fontSize: 14, color: T.textPrimary, fontWeight: "600" },
  addedItemMacros: { fontSize: 11, color: T.textSecondary, marginTop: 2 },
  removeItem: { color: T.textSecondary, fontSize: 16, paddingLeft: 12 },
  mealTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: T.accentDark,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: T.accentBorder,
  },
  mealTotalLabel: { color: T.accent, fontSize: 12, fontWeight: "700" },
  mealTotalValue: { color: T.accent, fontSize: 12, fontWeight: "700" },

  addItemBox: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  addItemTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 12 },

  input: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: T.textPrimary,
    fontSize: 14,
    marginBottom: 12,
  },
  macroInputRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  inputSmall: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: T.textPrimary,
    fontSize: 13,
  },
  expandToggle: { marginBottom: 10 },
  expandToggleText: { color: T.accent, fontSize: 13, fontWeight: "600" },
  addItemBtn: {
    backgroundColor: T.surface2,
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
    marginTop: 8,
  },
  addItemBtnText: { color: T.textPrimary, fontWeight: "700", fontSize: 14 },

  modalActions: { flexDirection: "row", gap: 12, paddingTop: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  cancelBtnText: { color: T.textSecondary, fontWeight: "700", fontSize: 15 },
  logBtn: {
    flex: 1,
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText: { color: T.accent, fontWeight: "700", fontSize: 15 },

  // Quick Re-Log
  recentSection: { marginBottom: 16 },
  recentTitle: { fontSize: 13, fontWeight: "700", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    marginBottom: 8,
  },
  recentItemLeft: { flex: 1, marginRight: 12 },
  recentItemName: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 3 },
  recentItemMacros: { fontSize: 12, color: T.textSecondary },
  recentAddBtn: {
    backgroundColor: T.accentDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.accentBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  recentAddBtnText: { color: T.accent, fontSize: 13, fontWeight: "700" },

  // Re-Log Modal Preview
  reLogPreview: {
    backgroundColor: T.surface2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  reLogPreviewName: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  reLogPreviewMacros: { fontSize: 13, color: T.textSecondary },

  // What to eat next
  nextMealCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 18,
    marginBottom: 16,
  },
  nextMealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  nextMealTitle: { fontSize: 15, fontWeight: "800", color: T.textPrimary },
  nextMealCalBadge: { backgroundColor: T.accentDark, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.accentBorder },
  nextMealCalBadgeText: { color: T.accent, fontSize: 12, fontWeight: "700" },
  nextMealFocus: { backgroundColor: T.bg, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  nextMealFocusLabel: { fontSize: 10, color: T.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  nextMealFocusMacro: { fontSize: 15, fontWeight: "800" },
  nextMealBars: { gap: 8, marginBottom: 16 },
  nextMealBarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nextMealBarLabel: { fontSize: 12, fontWeight: "700", color: T.textMuted, width: 14 },
  nextMealBarTrack: { flex: 1, height: 6, backgroundColor: T.surface2, borderRadius: 3, overflow: "hidden" },
  nextMealBarFill: { height: 6, borderRadius: 3 },
  nextMealBarVal: { fontSize: 11, color: T.textSecondary, width: 34, textAlign: "right" },
  nextMealBtn: {
    backgroundColor: T.accentDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.accentBorder,
    paddingVertical: 12,
    alignItems: "center",
  },
  nextMealBtnText: { color: T.accent, fontWeight: "700", fontSize: 14 },
});
