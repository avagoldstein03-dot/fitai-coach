import React, { useState } from "react";
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
import { posthog, Events } from "@/lib/analytics";

const SOURCES = [
  { key: "tiktok", icon: "🎵" },
  { key: "instagram", icon: "🎥" },
  { key: "app_store", icon: "🔍" },
  { key: "friend", icon: "👥" },
];

// Self-reported, not tracked — a real ad-attribution SDK could tell us this
// automatically later, but this needs zero new dependencies or ATT prompts
// and gives a real channel signal we don't have any other way to see yet.
const PAID_SOCIAL_SOURCES = new Set(["tiktok", "instagram"]);

export default function WelcomeScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [source, setSource] = useState<string | null>(null);
  const highlightReadiness = source !== null && PAID_SOCIAL_SOURCES.has(source);

  const selectSource = (key: string) => {
    Haptics.selectionAsync();
    setSource(key);
    posthog.capture(Events.ACQUISITION_SOURCE_SELECTED, { source: key });
  };

  const FEATURES = [
    { key: "readiness", icon: "🎯", title: t("welcome.feature_readiness_title"), desc: t("welcome.feature_readiness_desc"), color: T.green, bg: T.greenDark, badge: t("welcome.readiness_badge") },
    { key: "coach", icon: "🤖", title: t("welcome.feature_coach_title"), desc: t("welcome.feature_coach_desc"), color: T.accent, bg: T.accentDark },
    { key: "scan", icon: "📸", title: t("welcome.feature_scan_title"), desc: t("welcome.feature_scan_desc"), color: T.teal, bg: T.tealDark },
    { key: "workouts", icon: "💪", title: t("welcome.feature_workouts_title"), desc: t("welcome.feature_workouts_desc"), color: T.blue, bg: T.blueDark },
    { key: "body_scan", icon: "📊", title: t("welcome.feature_body_scan_title"), desc: t("welcome.feature_body_scan_desc"), color: T.amber, bg: T.amberDark },
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

        {/* Source self-report — lets us highlight what actually brought them here */}
        <Text style={s.sourceLabel}>{t("welcome.source_label")}</Text>
        <View style={s.sourceRow}>
          {SOURCES.map((src) => {
            const selected = source === src.key;
            return (
              <TouchableOpacity
                key={src.key}
                style={[s.sourceChip, selected && s.sourceChipSelected]}
                onPress={() => selectSource(src.key)}
                activeOpacity={0.8}
              >
                <Text style={s.sourceIcon}>{src.icon}</Text>
                <Text style={[s.sourceChipText, selected && s.sourceChipTextSelected]}>{t(`welcome.source_${src.key}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feature Cards */}
        <View style={s.features}>
          {FEATURES.map((f) => {
            const highlighted = f.key === "readiness" && highlightReadiness;
            return (
              <View
                key={f.key}
                style={[
                  s.featureCard,
                  { backgroundColor: f.bg, borderColor: f.color + "40" },
                  highlighted && [s.featureCardHighlighted, { borderColor: f.color, shadowColor: f.color }],
                ]}
              >
                <Text style={s.featureIcon}>{f.icon}</Text>
                <View style={s.featureBody}>
                  <View style={s.featureTitleRow}>
                    <Text style={[s.featureTitle, { color: f.color }]}>{f.title}</Text>
                    {f.badge && (
                      <View style={[s.featureBadge, { backgroundColor: f.color }]}>
                        <Text style={s.featureBadgeText}>{f.badge}</Text>
                      </View>
                    )}
                    {highlighted && (
                      <View style={[s.featureBadge, { backgroundColor: f.color }]}>
                        <Text style={s.featureBadgeText}>{t("welcome.source_highlight_tag")}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            );
          })}
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

  sourceLabel: { fontSize: 12, fontWeight: "700", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  sourceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 },
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  sourceChipSelected: { backgroundColor: T.accentDark, borderColor: T.accent },
  sourceIcon: { fontSize: 13 },
  sourceChipText: { fontSize: 12.5, fontWeight: "600", color: T.textSecondary },
  sourceChipTextSelected: { color: T.accent },

  features: { gap: 12, marginBottom: 28 },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  featureCardHighlighted: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  featureIcon: { fontSize: 28, width: 36, textAlign: "center" },
  featureBody: { flex: 1 },
  featureTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  featureTitle: { fontSize: 15, fontWeight: "800" },
  featureBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  featureBadgeText: { fontSize: 9, fontWeight: "800", color: "#000", letterSpacing: 0.5 },
  featureDesc: { fontSize: 13, color: T.textSecondary, lineHeight: 19 },

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
