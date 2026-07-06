import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useUpgradeGate } from "@/contexts/UpgradeGateContext";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface Supplement {
  name: string;
  category: string;
  reason: string;
  dosage: string;
  frequency: string;
  benefits: string[];
  dosageRange: string;
  disclaimer: string;
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

export default function SupplementsScreen() {
  const navigation = useNavigation() as any;
  const { presentUpgrade } = useUpgradeGate();
  const { t } = useTranslation();

  const openAmazon = (supplementName: string) => {
    const query = encodeURIComponent(`${supplementName} supplement`);
    Linking.openURL(`https://www.amazon.com/s?k=${query}`).catch(() =>
      Alert.alert(t("common.error"), t("supplements.error_amazon"))
    );
  };

  const { data, isLoading, refetch, isRefetching, error } = useQuery<{
    recommendations: Supplement[];
    disclaimer: string;
  }>({
    queryKey: ["supplements"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/supplements/recommendations`);
      return res.data.data;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  if (error) {
    const isPaywall = (error as any)?.response?.status === 403;
    return (
      <View style={styles.gateScreen}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={styles.gateIcon}>✨</Text>
        <Text style={styles.gateTitle}>
          {isPaywall ? t("supplements.premium_title") : t("supplements.error_title")}
        </Text>
        <Text style={styles.gateSub}>
          {isPaywall ? t("supplements.premium_sub") : t("supplements.error_sub")}
        </Text>
        {isPaywall && (
          <TouchableOpacity style={styles.upgradeBtn} onPress={presentUpgrade}>
            <Text style={styles.upgradeBtnText}>{t("common.upgrade")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.accent} />
      }
    >
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t("supplements.title")}</Text>
        <Text style={styles.subtitle}>{t("supplements.subtitle")}</Text>

        {data?.recommendations.map((supp, i) => {
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
        {data?.disclaimer && (
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerIcon}>⚠️</Text>
            <Text style={styles.disclaimerText}>{data.disclaimer}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },

  gateScreen: {
    flex: 1,
    backgroundColor: T.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  gateIcon: { fontSize: 52, marginBottom: 16 },
  gateTitle: { fontSize: 22, fontWeight: "800", color: T.textPrimary, marginBottom: 10, textAlign: "center" },
  gateSub: { fontSize: 14, color: T.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 },
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

  // Supplement Card
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
});
