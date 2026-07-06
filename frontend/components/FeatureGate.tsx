import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface FeatureGateProps {
  feature: "unlimited_meals" | "unlimited_workouts" | "premium_coaching" | "progress_reviews";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface SubscriptionData {
  subscription: { plan: "free" | "premium" };
}

const FEATURE_ICONS: Record<FeatureGateProps["feature"], string> = {
  unlimited_meals:    "🍽",
  unlimited_workouts: "💪",
  premium_coaching:   "🤖",
  progress_reviews:   "📈",
};

export default function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const FEATURE_LABELS: Record<FeatureGateProps["feature"], { title: string; description: string }> = {
    unlimited_meals:    { title: t("feature_gate.unlimited_meals_title"),    description: t("feature_gate.unlimited_meals_desc") },
    unlimited_workouts: { title: t("feature_gate.unlimited_workouts_title"), description: t("feature_gate.unlimited_workouts_desc") },
    premium_coaching:   { title: t("feature_gate.premium_coaching_title"),   description: t("feature_gate.premium_coaching_desc") },
    progress_reviews:   { title: t("feature_gate.progress_reviews_title"),   description: t("feature_gate.progress_reviews_desc") },
  };

  const { data: subscriptionData, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await axios.get<SubscriptionData>(`${API_URL}/api/subscriptions/status`);
      return res.data;
    },
  });

  const isPremium = subscriptionData?.subscription?.plan === "premium";

  if (isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={T.accent} />
      </View>
    );
  }

  if (isPremium) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  const { title, description } = FEATURE_LABELS[feature];

  return (
    <View style={s.gate}>
      <Text style={s.icon}>{FEATURE_ICONS[feature]}</Text>
      <View style={s.lockBadge}>
        <Text style={s.lockBadgeText}>{t("feature_gate.badge")}</Text>
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.description}>{description}</Text>
      <TouchableOpacity
        onPress={() => navigation.navigate("Pricing")}
        style={s.upgradeBtn}
        activeOpacity={0.85}
      >
        <Text style={s.upgradeBtnText}>{t("feature_gate.upgrade")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { padding: 24, alignItems: "center" },
  gate: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    margin: 16,
  },
  icon: { fontSize: 40, marginBottom: 12 },
  lockBadge: {
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 12,
  },
  lockBadgeText: { color: "#000", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: "800", color: T.textPrimary, textAlign: "center", marginBottom: 8 },
  description: { fontSize: 14, color: T.textSecondary, textAlign: "center", lineHeight: 21, marginBottom: 20 },
  upgradeBtn: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  upgradeBtnText: { color: "#000", fontWeight: "800", fontSize: 15 },
});
