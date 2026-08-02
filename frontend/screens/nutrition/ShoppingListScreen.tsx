import React, { useState } from "react";
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
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import axios from "axios";
import { useUpgradeGate, isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
  isCustom: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  Proteins: "🥩",
  Vegetables: "🥦",
  Fruits: "🍎",
  "Grains & Carbs": "🌾",
  "Dairy & Eggs": "🥛",
  "Pantry & Condiments": "🧂",
  Other: "🛒",
};

const EMPTY_CUSTOM_FORM = { name: "", quantity: "", unit: "" };

export default function ShoppingListScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const { presentUpgrade } = useUpgradeGate();
  const queryClient = useQueryClient();

  const CATEGORY_LABELS: Record<string, string> = {
    Proteins: t("shopping_list.cat_proteins"),
    Vegetables: t("shopping_list.cat_vegetables"),
    Fruits: t("shopping_list.cat_fruits"),
    "Grains & Carbs": t("shopping_list.cat_grains"),
    "Dairy & Eggs": t("shopping_list.cat_dairy"),
    "Pantry & Condiments": t("shopping_list.cat_pantry"),
    Other: t("shopping_list.cat_other"),
  };

  const [addCustomModalVisible, setAddCustomModalVisible] = useState(false);
  const [customForm, setCustomForm] = useState(EMPTY_CUSTOM_FORM);

  const { data: items, isLoading, error, refetch, isRefetching } = useQuery<ShoppingListItem[]>({
    queryKey: ["shopping-list"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/nutrition/shopping-list`);
      return res.data.data.items;
    },
    retry: false,
  });

  const { mutate: toggleItem } = useMutation({
    mutationFn: async (item: ShoppingListItem) =>
      axios.patch(`${API_URL}/api/nutrition/shopping-list`, {
        action: "toggle",
        id: item.id,
        checked: !item.checked,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-list"] }),
    onError: () => Alert.alert(t("common.error"), t("shopping_list.error_toggle")),
  });

  const { mutate: addCustomItem, isPending: isAdding } = useMutation({
    mutationFn: async () =>
      axios.patch(`${API_URL}/api/nutrition/shopping-list`, {
        action: "add",
        name: customForm.name.trim(),
        quantity: customForm.quantity ? Number(customForm.quantity) : undefined,
        unit: customForm.unit.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
      setAddCustomModalVisible(false);
      setCustomForm(EMPTY_CUSTOM_FORM);
    },
    onError: (err: any) => {
      if (isPremiumRequiredError(err)) {
        presentUpgrade();
        return;
      }
      Alert.alert(t("common.error"), t("shopping_list.error_add"));
    },
  });

  const { mutate: removeItem } = useMutation({
    mutationFn: async (id: string) =>
      axios.patch(`${API_URL}/api/nutrition/shopping-list`, { action: "remove", id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-list"] }),
    onError: () => Alert.alert(t("common.error"), t("shopping_list.error_remove")),
  });

  const allItems = items ?? [];
  const checkedCount = allItems.filter((item) => item.checked).length;
  const progress = allItems.length > 0 ? checkedCount / allItems.length : 0;

  const grouped = allItems.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const clearChecked = () => {
    Alert.alert(t("shopping_list.clear_title"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("shopping_list.clear_confirm"),
        style: "destructive",
        onPress: () => allItems.filter((i) => i.checked).forEach((i) => toggleItem(i)),
      },
    ]);
  };

  const checkAll = () => allItems.filter((i) => !i.checked).forEach((i) => toggleItem(i));

  const shareList = async () => {
    const text = Object.entries(grouped)
      .map(
        ([cat, catItems]) =>
          `${CATEGORY_ICONS[cat] ?? "🛒"} ${CATEGORY_LABELS[cat] ?? cat}\n${catItems
            .map((i) => `  • ${i.name}`)
            .join("\n")}`
      )
      .join("\n\n");
    await Share.share({ message: `${t("shopping_list.share_heading")}\n\n${text}` });
  };

  const openSearch = (baseUrl: (query: string) => string) => {
    const unchecked = allItems.filter((i) => !i.checked);
    const query = (unchecked.length > 0 ? unchecked : allItems).map((i) => i.name).join(", ");
    Linking.openURL(baseUrl(query)).catch(() =>
      Alert.alert(t("common.error"), t("shopping_list.error_service"))
    );
  };

  const GROCERY_SERVICES = [
    {
      name: "Instacart",
      emoji: "🛒",
      color: "#43b02a",
      onPress: () => openSearch(() => "https://www.instacart.com"),
    },
    {
      name: "Amazon",
      emoji: "📦",
      color: "#ff9900",
      onPress: () => openSearch((q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`),
    },
    {
      name: "Walmart",
      emoji: "🏪",
      color: "#0071ce",
      onPress: () => openSearch((q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`),
    },
  ];

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
      ) : isPremiumRequiredError(error) ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyTitle}>{t("shopping_list.premium_title")}</Text>
          <Text style={styles.emptySub}>{t("shopping_list.premium_sub")}</Text>
          <TouchableOpacity onPress={presentUpgrade} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>{t("common.upgrade")}</Text>
          </TouchableOpacity>
        </View>
      ) : error || allItems.length === 0 ? (
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
                  onPress={svc.onPress}
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
          {Object.entries(grouped).map(([category, catItems]) => (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[category] ?? "🛒"}</Text>
                <Text style={styles.categoryName}>{CATEGORY_LABELS[category] ?? category}</Text>
                <Text style={styles.categoryCount}>
                  {catItems.filter((i) => i.checked).length}/{catItems.length}
                </Text>
              </View>

              <View style={styles.categoryCard}>
                {catItems.map((item, idx) => (
                  <SwipeToDeleteRow
                    key={item.id}
                    onDelete={() => removeItem(item.id)}
                    deleteLabel={t("common.delete")}
                  >
                    <TouchableOpacity
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleItem(item); }}
                      style={[
                        styles.itemRow,
                        idx < catItems.length - 1 && styles.itemRowBorder,
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                        {item.checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                        {item.name}
                        {item.quantity > 1 || item.unit ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ""})` : ""}
                      </Text>
                    </TouchableOpacity>
                  </SwipeToDeleteRow>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => setAddCustomModalVisible(true)}
            style={styles.addCustomLink}
          >
            <Text style={styles.addCustomLinkText}>{t("shopping_list.add_custom_item")}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={addCustomModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t("shopping_list.add_custom_item")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("shopping_list.add_custom_name_placeholder")}
              placeholderTextColor={T.textMuted}
              value={customForm.name}
              onChangeText={(v) => setCustomForm((f) => ({ ...f, name: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder={t("shopping_list.add_custom_qty_placeholder")}
              placeholderTextColor={T.textMuted}
              keyboardType="number-pad"
              value={customForm.quantity}
              onChangeText={(v) => setCustomForm((f) => ({ ...f, quantity: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder={t("shopping_list.add_custom_unit_placeholder")}
              placeholderTextColor={T.textMuted}
              value={customForm.unit}
              onChangeText={(v) => setCustomForm((f) => ({ ...f, unit: v }))}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setAddCustomModalVisible(false); setCustomForm(EMPTY_CUSTOM_FORM); }}
              >
                <Text style={styles.cancelBtnText}>{t("shopping_list.add_custom_cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                disabled={isAdding || !customForm.name.trim()}
                onPress={() => addCustomItem()}
              >
                {isAdding ? <ActivityIndicator color={T.accent} /> : <Text style={styles.saveBtnText}>{t("shopping_list.add_custom_save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: T.surface,
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

  addCustomLink: { alignItems: "center", paddingVertical: 12 },
  addCustomLinkText: { color: T.accent, fontWeight: "600", fontSize: 14 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: T.border, padding: 24, maxHeight: "80%",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary, marginBottom: 20 },
  input: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: T.textPrimary, fontSize: 14, marginBottom: 14,
  },
  modalActions: { flexDirection: "row", gap: 12, paddingTop: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 14, padding: 16, alignItems: "center",
  },
  cancelBtnText: { color: T.textSecondary, fontWeight: "700", fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accent,
    borderRadius: 14, padding: 16, alignItems: "center",
  },
  saveBtnText: { color: T.accent, fontWeight: "700", fontSize: 15 },
});
