import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  Linking,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import axios from "axios";
import { useUpgradeGate } from "@/contexts/UpgradeGateContext";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface CheckedMap {
  [item: string]: boolean;
}

function parseShoppingList(rawText: string): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    Proteins: [],
    Vegetables: [],
    Fruits: [],
    "Grains & Carbs": [],
    "Dairy & Eggs": [],
    "Pantry & Condiments": [],
  };

  const proteinKeywords = ["chicken", "turkey", "beef", "salmon", "tuna", "shrimp", "tofu", "eggs", "egg", "whey", "protein", "fish", "steak", "pork"];
  const vegKeywords = ["broccoli", "spinach", "kale", "carrot", "celery", "pepper", "onion", "garlic", "tomato", "cucumber", "zucchini", "lettuce", "asparagus", "green bean"];
  const fruitKeywords = ["apple", "banana", "berry", "blueberry", "strawberry", "orange", "mango", "grape", "pineapple", "lemon", "lime", "avocado"];
  const grainKeywords = ["rice", "oat", "bread", "pasta", "quinoa", "sweet potato", "potato", "tortilla", "wrap", "cereal", "granola"];
  const dairyKeywords = ["milk", "yogurt", "cheese", "cottage", "greek", "butter", "cream"];
  const pantryKeywords = ["oil", "olive oil", "salt", "pepper", "sauce", "spice", "seasoning", "vinegar", "honey", "almond", "nut", "peanut", "seed", "flax", "chia"];

  const lines = rawText.split("\n");
  const seen = new Set<string>();

  for (const line of lines) {
    const clean = line
      .replace(/^[-*•\d.)\s]+/, "")
      .replace(/\(.*?\)/g, "")
      .replace(/:\s*$/, "")
      .trim()
      .toLowerCase();

    if (!clean || clean.length < 3 || clean.length > 60) continue;
    if (/^(day|meal|breakfast|lunch|dinner|snack|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(clean)) continue;
    if (/^\d+\s*(oz|g|mg|cal|kcal|cup|tbsp|tsp)/i.test(line)) continue;

    const normalized = clean
      .replace(/\d+\s*(oz|g|mg|cup|tbsp|tsp|lb|ml)\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const display = normalized.charAt(0).toUpperCase() + normalized.slice(1);

    if (proteinKeywords.some((k) => normalized.includes(k))) {
      categories["Proteins"].push(display);
    } else if (vegKeywords.some((k) => normalized.includes(k))) {
      categories["Vegetables"].push(display);
    } else if (fruitKeywords.some((k) => normalized.includes(k))) {
      categories["Fruits"].push(display);
    } else if (grainKeywords.some((k) => normalized.includes(k))) {
      categories["Grains & Carbs"].push(display);
    } else if (dairyKeywords.some((k) => normalized.includes(k))) {
      categories["Dairy & Eggs"].push(display);
    } else if (pantryKeywords.some((k) => normalized.includes(k))) {
      categories["Pantry & Condiments"].push(display);
    }
  }

  return Object.fromEntries(
    Object.entries(categories).filter(([, items]) => items.length > 0)
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  Proteins: "🥩",
  Vegetables: "🥦",
  Fruits: "🍎",
  "Grains & Carbs": "🌾",
  "Dairy & Eggs": "🥛",
  "Pantry & Condiments": "🧂",
};

const GROCERY_SERVICES = [
  {
    name: "Instacart",
    emoji: "🛒",
    color: "#43b02a",
    url: "https://www.instacart.com",
  },
  {
    name: "Amazon Fresh",
    emoji: "📦",
    color: "#ff9900",
    url: "https://www.amazon.com/fmc/storefront?almBrandId=QW1hem9uIEZyZXNo",
  },
  {
    name: "Walmart",
    emoji: "🏪",
    color: "#0071ce",
    url: "https://www.walmart.com/grocery",
  },
];

export default function ShoppingListScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const { presentUpgrade } = useUpgradeGate();
  const CATEGORY_LABELS: Record<string, string> = {
    Proteins: t("shopping_list.cat_proteins"),
    Vegetables: t("shopping_list.cat_vegetables"),
    Fruits: t("shopping_list.cat_fruits"),
    "Grains & Carbs": t("shopping_list.cat_grains"),
    "Dairy & Eggs": t("shopping_list.cat_dairy"),
    "Pantry & Condiments": t("shopping_list.cat_pantry"),
  };
  const [checked, setChecked] = useState<CheckedMap>({});

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["nutrition-plan"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/nutrition/plan`);
      return res.data?.data?.plan;
    },
    retry: false,
  });

  const rawText: string = (data?.mealPlan as any)?.rawText ?? "";

  const shoppingList = useMemo(
    () => (rawText ? parseShoppingList(rawText) : {}),
    [rawText]
  );

  const allItems = Object.values(shoppingList).flat();
  const checkedCount = allItems.filter((item) => checked[item]).length;

  const toggleItem = (item: string) =>
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));

  const clearChecked = () => {
    Alert.alert(t("shopping_list.clear_title"), "", [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("shopping_list.clear_confirm"), style: "destructive", onPress: () => setChecked({}) },
    ]);
  };

  const checkAll = () => {
    const all: CheckedMap = {};
    allItems.forEach((item) => (all[item] = true));
    setChecked(all);
  };

  const shareList = async () => {
    const text = Object.entries(shoppingList)
      .map(
        ([cat, items]) =>
          `${CATEGORY_ICONS[cat] ?? "🛒"} ${CATEGORY_LABELS[cat] ?? cat}\n${items.map((i) => `  • ${i}`).join("\n")}`
      )
      .join("\n\n");
    await Share.share({ message: `${t("shopping_list.share_heading")}\n\n${text}` });
  };

  const openService = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert(t("common.error"), t("shopping_list.error_service"))
    );
  };

  const progress = allItems.length > 0 ? checkedCount / allItems.length : 0;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("nutrition.shopping_list")}</Text>
          {allItems.length > 0 && (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={checkAll} style={styles.headerActionBtn}>
                <Text style={styles.headerActionText}>{t("shopping_list.action_all")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearChecked} style={styles.headerActionBtn}>
                <Text style={styles.headerActionText}>{t("shopping_list.action_clear")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={shareList} style={styles.headerActionBtn}>
                <Text style={styles.headerActionText}>{t("shopping_list.action_share")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : (error as any)?.response?.status === 403 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyTitle}>{t("supplements.premium_title")}</Text>
          <Text style={styles.emptySub}>{t("supplements.premium_sub")}</Text>
          <TouchableOpacity onPress={presentUpgrade} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>{t("common.upgrade")}</Text>
          </TouchableOpacity>
        </View>
      ) : error || !rawText || allItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>{t("shopping_list.empty_title")}</Text>
          <Text style={styles.emptySub}>{t("shopping_list.empty_sub")}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Nutrition")}
            style={styles.emptyBtn}
          >
            <Text style={styles.emptyBtnText}>{t("shopping_list.go_to_nutrition")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.accent} />
          }
        >
          {/* Progress Bar */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{t("shopping_list.progress_label")}</Text>
              <Text style={styles.progressCount}>
                {t("shopping_list.items_count", { checked: checkedCount, total: allItems.length })}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
            {checkedCount === allItems.length && allItems.length > 0 && (
              <Text style={styles.progressDone}>{t("shopping_list.all_done")}</Text>
            )}
          </View>

          {/* Order Online Section */}
          <View style={styles.orderSection}>
            <Text style={styles.orderTitle}>{t("shopping_list.order_online")}</Text>
            <View style={styles.serviceGrid}>
              {GROCERY_SERVICES.map((svc) => (
                <TouchableOpacity
                  key={svc.name}
                  onPress={() => openService(svc.url)}
                  style={styles.serviceCard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.serviceEmoji}>{svc.emoji}</Text>
                  <Text style={styles.serviceName}>{svc.name}</Text>
                  <Text style={[styles.serviceArrow, { color: svc.color }]}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Lists */}
          {Object.entries(shoppingList).map(([category, items]) => (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[category] ?? "🛒"}</Text>
                <Text style={styles.categoryName}>{CATEGORY_LABELS[category] ?? category}</Text>
                <Text style={styles.categoryCount}>
                  {items.filter((i) => checked[i]).length}/{items.length}
                </Text>
              </View>

              <View style={styles.categoryCard}>
                {items.map((item, idx) => (
                  <TouchableOpacity
                    key={`${category}-${idx}`}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleItem(item); }}
                    style={[
                      styles.itemRow,
                      idx < items.length - 1 && styles.itemRowBorder,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        checked[item] && styles.checkboxChecked,
                      ]}
                    >
                      {checked[item] && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text
                      style={[
                        styles.itemText,
                        checked[item] && styles.itemTextChecked,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  backBtn: { marginBottom: 12 },
  backText: { color: T.accent, fontSize: 15, fontWeight: "600" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "800", color: T.textPrimary, letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", gap: 6 },
  headerActionBtn: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerActionText: { color: T.textSecondary, fontSize: 12, fontWeight: "600" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary, marginBottom: 8, textAlign: "center" },
  emptySub: { fontSize: 14, color: T.textSecondary, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyBtnText: { color: T.accent, fontWeight: "700", fontSize: 15 },
  upgradeBtn: { backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 16 },
  upgradeBtnText: { color: T.accent, fontWeight: "800", fontSize: 16 },

  scrollContent: { padding: 20, paddingBottom: 48 },

  // Progress
  progressCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 20,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  progressLabel: { fontSize: 13, color: T.textSecondary, fontWeight: "600" },
  progressCount: { fontSize: 13, color: T.accent, fontWeight: "700" },
  progressTrack: { height: 5, backgroundColor: T.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: T.accent, borderRadius: 3 },
  progressDone: { color: T.green, fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 10 },

  // Order Section
  orderSection: { marginBottom: 24 },
  orderTitle: { fontSize: 13, color: T.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  serviceGrid: { flexDirection: "row", gap: 10 },
  serviceCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  serviceEmoji: { fontSize: 22 },
  serviceName: { fontSize: 12, color: T.textSecondary, fontWeight: "600", textAlign: "center" },
  serviceArrow: { fontSize: 14, fontWeight: "800" },

  // Category
  categorySection: { marginBottom: 20 },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  categoryIcon: { fontSize: 18 },
  categoryName: { flex: 1, fontSize: 15, fontWeight: "700", color: T.textPrimary },
  categoryCount: { fontSize: 12, color: T.textMuted, fontWeight: "600" },

  categoryCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  itemRowBorder: { borderBottomWidth: 1, borderColor: T.border },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: T.border2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: T.accent, borderColor: T.accent },
  checkmark: { color: T.black, fontSize: 12, fontWeight: "800" },
  itemText: { flex: 1, fontSize: 14, color: T.textPrimary },
  itemTextChecked: { color: T.textMuted, textDecorationLine: "line-through" },
});
