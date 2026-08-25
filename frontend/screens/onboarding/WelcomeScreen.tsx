import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";

export default function WelcomeScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();

  const PLUS_FEATURES = [
    { icon: "🤖", title: t("welcome.feature_coach_title") },
    { icon: "📸", title: t("welcome.feature_scan_title") },
    { icon: "💪", title: t("welcome.feature_workouts_title") },
    { icon: "📊", title: t("welcome.feature_body_scan_title") },
  ];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <View style={s.container}>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.logoEmoji}>🏆</Text>
          <Text style={s.appName}>Active AI</Text>
          <Text style={s.tagline}>{t("welcome.tagline")}</Text>
        </View>

        {/* Readiness spotlight — the single, free, headline feature */}
        <View style={s.readinessCard}>
          <View style={s.readinessBadge}>
            <Text style={s.readinessBadgeText}>{t("welcome.readiness_badge")}</Text>
          </View>
          <Text style={s.readinessHeadline}>{t("welcome.readiness_headline")}</Text>
          <Text style={s.readinessDesc}>{t("welcome.readiness_desc")}</Text>
        </View>

        {/* Plus everything else — compact, secondary */}
        <Text style={s.plusLabel}>{t("welcome.plus_label")}</Text>
        <View style={s.plusRow}>
          {PLUS_FEATURES.map((f, i) => (
            <View key={i} style={s.plusItem}>
              <Text style={s.plusIcon}>{f.icon}</Text>
              <Text style={s.plusTitle}>{f.title}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate("Step1"); }}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={s.ctaBtnText}>{t("welcome.cta")}</Text>
        </TouchableOpacity>

        <Text style={s.finePrint}>{t("welcome.fine_print")}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48 },

  hero: { alignItems: "center", marginBottom: 40 },
  logoEmoji: { fontSize: 56, marginBottom: 12 },
  appName: {
    fontSize: 34,
    fontWeight: "800",
    color: T.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 17,
    color: T.textSecondary,
    textAlign: "center",
    lineHeight: 26,
  },

  readinessCard: {
    backgroundColor: T.greenDark,
    borderWidth: 1,
    borderColor: T.greenBorder,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  readinessBadge: {
    alignSelf: "flex-start",
    backgroundColor: T.green,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  readinessBadgeText: { fontSize: 10, fontWeight: "800", color: "#000", letterSpacing: 0.6 },
  readinessHeadline: { fontSize: 19, fontWeight: "800", color: T.green, marginBottom: 6 },
  readinessDesc: { fontSize: 14, color: T.textSecondary, lineHeight: 21 },

  plusLabel: { fontSize: 12, fontWeight: "700", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  plusRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  plusItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  plusIcon: { fontSize: 15 },
  plusTitle: { fontSize: 12.5, fontWeight: "600", color: T.textSecondary },

  ctaBtn: {
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  ctaBtnText: { color: "#000", fontSize: 18, fontWeight: "800" },
  finePrint: { fontSize: 12, color: T.textMuted, textAlign: "center" },
});
