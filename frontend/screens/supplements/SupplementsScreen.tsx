import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useUpgradeGate, isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface Recommendation {
  name: string;
  category: string;
  reason: string;
  dosage: string;
  frequency: string;
  benefits: string[];
  dosageRange: string;
  disclaimer: string;
}

interface StackItem {
  id: string;
  name: string;
  category: string;
  dosage: string;
  frequency: string;
  reason: string;
}

const CATEGORY_META: Record<string, { icon: string; color: string; bg: string }> = {
  creatine:       { icon: "⚡", color: T.blue,    bg: T.blueDark    },
  protein_powder: { icon: "🥛", color: T.teal,    bg: T.tealDark    },
  vitamin_d:      { icon: "☀️", color: T.amber,   bg: T.amberDark   },
  fish_oil:       { icon: "🐟", color: T.green,   bg: T.greenDark   },
  magnesium:      { icon: "💊", color: T.accent,  bg: T.accentDark  },
  electrolytes:   { icon: "💧", color: T.teal,    bg: T.tealDark    },
};

const DEFAULT_META = { icon: "💊", color: T.accent, bg: T.accentDark };

const EMPTY_CUSTOM_FORM = { name: "", dosage: "", frequency: "", reason: "" };

export default function SupplementsScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { presentUpgrade } = useUpgradeGate();
  const { t } = useTranslation();

  const [editModal, setEditModal] = useState<StackItem | null>(null);
  const [editForm, setEditForm] = useState({ dosage: "", frequency: "", reason: "" });
  const [addCustomModalVisible, setAddCustomModalVisible] = useState(false);
  const [customForm, setCustomForm] = useState(EMPTY_CUSTOM_FORM);

  const openAmazon = (supplementName: string) => {
    const query = encodeURIComponent(`${supplementName} supplement`);
    Linking.openURL(`https://www.amazon.com/s?k=${query}`).catch(() =>
      Alert.alert(t("common.error"), t("supplements.error_amazon"))
    );
  };

  const {
    data: stackData,
    isLoading: isLoadingStack,
    refetch: refetchStack,
    isRefetching: isRefetchingStack,
  } = useQuery<{ stack: StackItem[] }>({
    queryKey: ["supplementStack"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/supplements/stack`);
      return res.data.data;
    },
  });

  const {
    data: recsData,
    isLoading: isLoadingRecs,
    error: recsError,
  } = useQuery<{ recommendations: Recommendation[]; disclaimer: string }>({
    queryKey: ["supplements"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/supplements/recommendations`);
      return res.data.data;
    },
    retry: false,
  });

  const { mutate: addToStack, isPending: isAdding } = useMutation({
    mutationFn: async (item: { name: string; dosage: string; frequency: string; reason?: string }) => {
      await axios.post(`${API_URL}/api/supplements/stack`, item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplementStack"] });
      setAddCustomModalVisible(false);
      setCustomForm(EMPTY_CUSTOM_FORM);
    },
    onError: (err: any) => {
      if (isPremiumRequiredError(err)) {
        presentUpgrade();
        return;
      }
      Alert.alert(t("common.error"), err.response?.data?.message || t("supplements.error_add"));
    },
  });

  const { mutate: editSupplement, isPending: isEditing } = useMutation({
    mutationFn: async () => {
      await axios.patch(`${API_URL}/api/supplements/stack/${editModal!.id}`, editForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplementStack"] });
      setEditModal(null);
    },
    onError: (err: any) => Alert.alert(t("common.error"), err.response?.data?.message || t("supplements.error_edit")),
  });

  const { mutate: deleteSupplement } = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_URL}/api/supplements/stack/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplementStack"] }),
    onError: () => Alert.alert(t("common.error"), t("supplements.error_delete")),
  });

  if (isLoadingStack) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  const isRecsPaywalled = (recsError as any)?.response?.status === 403;
  const stack = stackData?.stack ?? [];

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetchingStack} onRefresh={refetchStack} tintColor={T.accent} />
      }
    >
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t("supplements.title")}</Text>
        <Text style={styles.subtitle}>{t("supplements.subtitle")}</Text>

        {/* My Stack */}
        <Text style={styles.sectionTitle}>{t("supplements.my_stack_title")}</Text>
        {stack.length === 0 ? (
          <View style={styles.emptyStackCard}>
            <Text style={styles.emptyStackText}>{t("supplements.my_stack_empty")}</Text>
          </View>
        ) : (
          stack.map((item) => {
            const meta = CATEGORY_META[item.category] ?? DEFAULT_META;
            return (
              <SwipeToDeleteRow
                key={item.id}
                onDelete={() => deleteSupplement(item.id)}
                deleteLabel={t("common.delete")}
                borderRadius={16}
              >
                <View style={[styles.stackCard, styles.stackCardWrapper]}>
                  <View style={[styles.iconCircle, { backgroundColor: meta.color + "20" }]}>
                    <Text style={styles.iconEmoji}>{meta.icon}</Text>
                  </View>
                  <View style={styles.stackCardBody}>
                    <View style={styles.stackCardTitleRow}>
                      <Text style={styles.suppName}>{item.name}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setEditForm({ dosage: item.dosage, frequency: item.frequency, reason: item.reason });
                          setEditModal(item);
                        }}
                        style={styles.editBtn}
                        accessibilityLabel={t("common.edit")}
                        accessibilityRole="button"
                      >
                        <Text style={styles.editBtnIcon}>✎</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.stackCardMeta}>{item.dosage} · {item.frequency}</Text>
                    {item.reason ? <Text style={styles.stackCardReason}>{item.reason}</Text> : null}
                  </View>
                </View>
              </SwipeToDeleteRow>
            );
          })
        )}
        <TouchableOpacity
          onPress={() => { setCustomForm(EMPTY_CUSTOM_FORM); setAddCustomModalVisible(true); }}
          style={styles.addCustomLink}
        >
          <Text style={styles.addCustomLinkText}>{t("supplements.add_custom")}</Text>
        </TouchableOpacity>

        {/* Recommendations */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{t("supplements.recommendations_title")}</Text>

        {isLoadingRecs ? (
          <ActivityIndicator size="small" color={T.accent} style={{ marginVertical: 20 }} />
        ) : recsError ? (
          <View style={styles.inlineGateCard}>
            <Text style={styles.gateIcon}>✨</Text>
            <Text style={styles.gateTitle}>
              {isRecsPaywalled ? t("supplements.premium_title") : t("supplements.error_title")}
            </Text>
            <Text style={styles.gateSub}>
              {isRecsPaywalled ? t("supplements.premium_sub") : t("supplements.error_sub")}
            </Text>
            {isRecsPaywalled && (
              <TouchableOpacity style={styles.upgradeBtn} onPress={presentUpgrade}>
                <Text style={styles.upgradeBtnText}>{t("common.upgrade")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {recsData?.recommendations.map((supp, i) => {
              const meta = CATEGORY_META[supp.category] ?? DEFAULT_META;
              return (
                <View key={i} style={[styles.card, { borderColor: meta.color + "30", backgroundColor: meta.bg }]}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: meta.color + "20" }]}>
                      <Text style={styles.iconEmoji}>{meta.icon}</Text>
                    </View>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.suppName}>{supp.name}</Text>
                      <Text style={styles.suppCategory}>
                        {supp.category.replace(/_/g, " ")}
                      </Text>
                    </View>
                    <View style={[styles.dosageBadge, { borderColor: meta.color + "50" }]}>
                      <Text style={[styles.dosageBadgeText, { color: meta.color }]}>
                        {supp.dosageRange}
                      </Text>
                    </View>
                  </View>

                  {/* Why */}
                  <Text style={styles.reason}>{supp.reason}</Text>

                  {/* Dosage / Frequency */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>{t("supplements.dosage")}</Text>
                      <Text style={styles.metaValue}>{supp.dosage}</Text>
                    </View>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>{t("supplements.when")}</Text>
                      <Text style={[styles.metaValue, { textTransform: "capitalize" }]}>
                        {supp.frequency}
                      </Text>
                    </View>
                  </View>

                  {/* Benefits */}
                  <View style={styles.benefitsBlock}>
                    {supp.benefits.map((b, j) => (
                      <View key={j} style={styles.benefitRow}>
                        <Text style={[styles.benefitCheck, { color: meta.color }]}>✓</Text>
                        <Text style={styles.benefitText}>{b}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.addToStackBtn, { borderColor: meta.color + "40" }]}
                    onPress={() => addToStack({ name: supp.name, dosage: supp.dosage, frequency: supp.frequency, reason: supp.reason })}
                    disabled={isAdding}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.addToStackBtnText, { color: meta.color }]}>
                      {t("supplements.add_to_stack")}
                    </Text>
                  </TouchableOpacity>

                  {/* Buy Button */}
                  <TouchableOpacity
                    style={[styles.buyBtn, { borderColor: meta.color + "40" }]}
                    onPress={() => openAmazon(supp.name)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buyBtnEmoji}>📦</Text>
                    <Text style={[styles.buyBtnText, { color: meta.color }]}>
                      {t("supplements.shop_amazon")}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Disclaimer */}
            {recsData?.disclaimer && (
              <View style={styles.disclaimerCard}>
                <Text style={styles.disclaimerIcon}>⚠️</Text>
                <Text style={styles.disclaimerText}>{recsData.disclaimer}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Edit Modal */}
      <Modal visible={!!editModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editModal?.name}</Text>
            <Text style={styles.fieldLabel}>{t("supplements.dosage_label")}</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={T.textMuted}
              value={editForm.dosage}
              onChangeText={(v) => setEditForm((f) => ({ ...f, dosage: v }))}
            />
            <Text style={styles.fieldLabel}>{t("supplements.frequency_label")}</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={T.textMuted}
              value={editForm.frequency}
              onChangeText={(v) => setEditForm((f) => ({ ...f, frequency: v }))}
            />
            <Text style={styles.fieldLabel}>{t("supplements.reason_optional")}</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={T.textMuted}
              value={editForm.reason}
              onChangeText={(v) => setEditForm((f) => ({ ...f, reason: v }))}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(null)}>
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                disabled={isEditing || !editForm.dosage.trim() || !editForm.frequency.trim()}
                onPress={() => editSupplement()}
              >
                {isEditing ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{t("common.save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Custom Modal */}
      <Modal visible={addCustomModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t("supplements.add_custom_title")}</Text>
            <Text style={styles.fieldLabel}>{t("supplements.name_label")}</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={T.textMuted}
              value={customForm.name}
              onChangeText={(v) => setCustomForm((f) => ({ ...f, name: v }))}
            />
            <Text style={styles.fieldLabel}>{t("supplements.dosage_label")}</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={T.textMuted}
              value={customForm.dosage}
              onChangeText={(v) => setCustomForm((f) => ({ ...f, dosage: v }))}
            />
            <Text style={styles.fieldLabel}>{t("supplements.frequency_label")}</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={T.textMuted}
              value={customForm.frequency}
              onChangeText={(v) => setCustomForm((f) => ({ ...f, frequency: v }))}
            />
            <Text style={styles.fieldLabel}>{t("supplements.reason_optional")}</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={T.textMuted}
              value={customForm.reason}
              onChangeText={(v) => setCustomForm((f) => ({ ...f, reason: v }))}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddCustomModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                disabled={isAdding || !customForm.name.trim() || !customForm.dosage.trim() || !customForm.frequency.trim()}
                onPress={() => addToStack(customForm)}
              >
                {isAdding ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{t("common.save")}</Text>}
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
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },

  gateIcon: { fontSize: 40, marginBottom: 12 },
  gateTitle: { fontSize: 17, fontWeight: "800", color: T.textPrimary, marginBottom: 8, textAlign: "center" },
  gateSub: { fontSize: 13, color: T.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 18 },
  inlineGateCard: {
    backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border,
    padding: 24, alignItems: "center", marginBottom: 16,
  },
  upgradeBtn: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  upgradeBtnText: { color: T.accent, fontWeight: "800", fontSize: 16 },

  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48 },

  backBtn: { marginBottom: 20 },
  backText: { color: T.accent, fontSize: 15, fontWeight: "600" },

  title: { fontSize: 30, fontWeight: "800", color: T.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 14, color: T.textSecondary, marginBottom: 24 },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: T.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },

  // My Stack
  emptyStackCard: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16,
    padding: 18, marginBottom: 12,
  },
  emptyStackText: { color: T.textSecondary, fontSize: 13, textAlign: "center" },
  stackCard: {
    flexDirection: "row", backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, padding: 14, gap: 12,
  },
  stackCardWrapper: { marginBottom: 8 },
  stackCardBody: { flex: 1 },
  stackCardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  stackCardMeta: { fontSize: 12, color: T.textSecondary, marginTop: 2 },
  stackCardReason: { fontSize: 11, color: T.textMuted, marginTop: 2, fontStyle: "italic" },
  editBtn: { padding: 4 },
  editBtnIcon: { fontSize: 14, color: T.textSecondary },
  addCustomLink: { alignItems: "center", marginBottom: 24, marginTop: 4 },
  addCustomLinkText: { color: T.accent, fontSize: 13, fontWeight: "600" },

  // Supplement Card (recommendations)
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 20 },
  cardTitleBlock: { flex: 1 },
  suppName: { fontSize: 16, fontWeight: "800", color: T.textPrimary, marginBottom: 2 },
  suppCategory: {
    fontSize: 11,
    color: T.textSecondary,
    fontWeight: "600",
    textTransform: "capitalize",
    letterSpacing: 0.3,
  },
  dosageBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dosageBadgeText: { fontSize: 11, fontWeight: "800" },

  reason: { fontSize: 14, color: T.textSecondary, lineHeight: 21, marginBottom: 14 },

  metaRow: {
    flexDirection: "row",
    backgroundColor: T.overlay,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignItems: "center",
  },
  metaItem: { flex: 1, alignItems: "center" },
  metaLabel: { fontSize: 10, color: T.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  metaValue: { fontSize: 13, color: T.textPrimary, fontWeight: "600" },
  metaDivider: { width: 1, height: 28, backgroundColor: T.border },

  benefitsBlock: { marginBottom: 16, gap: 6 },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  benefitCheck: { fontSize: 12, fontWeight: "800", marginTop: 2 },
  benefitText: { flex: 1, fontSize: 13, color: T.textSecondary, lineHeight: 19 },

  addToStackBtn: {
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12,
    paddingVertical: 12, backgroundColor: T.overlay, marginBottom: 10,
  },
  addToStackBtnText: { fontSize: 14, fontWeight: "700" },

  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: T.overlay,
  },
  buyBtnEmoji: { fontSize: 15 },
  buyBtnText: { fontSize: 14, fontWeight: "700" },

  // Disclaimer
  disclaimerCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    alignItems: "flex-start",
  },
  disclaimerIcon: { fontSize: 16, marginTop: 1 },
  disclaimerText: { flex: 1, fontSize: 12, color: T.textMuted, lineHeight: 18 },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: T.border, padding: 24, maxHeight: "80%",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary, marginBottom: 20 },
  fieldLabel: { fontSize: 13, color: T.textSecondary, marginBottom: 6, fontWeight: "600" },
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
