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

  const FEATURES = [
    { icon: "🤖", title: t("welcome.feature_coach_title"), desc: t("welcome.feature_coach_desc"), color: T.accent, bg: T.accentDark },
    { icon: "📸", title: t("welcome.feature_scan_title"), desc: t("welcome.feature_scan_desc"), color: T.teal, bg: T.tealDark },
    { icon: "💪", title: t("welcome.feature_workouts_title"), desc: t("welcome.feature_workouts_desc"), color: T.blue, bg: T.blueDark },
    { icon: "📊", title: t("welcome.feature_body_scan_title"), desc: t("welcome.feature_body_scan_desc"), color: T.amber, bg: T.amberDark },
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

        {/* Feature Cards */}
        <View style={s.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[s.featureCard, { backgroundColor: f.bg, borderColor: f.color + "40" }]}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <View style={s.featureBody}>
                <Text style={[s.featureTitle, { color: f.color }]}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
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

  features: { gap: 12, marginBottom: 28 },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  featureIcon: { fontSize: 28, width: 36, textAlign: "center" },
  featureBody: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: "800", marginBottom: 3 },
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
