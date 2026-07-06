import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import OnboardingHeader from "@/components/OnboardingHeader";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const DIETS: { id: string; icon: string }[] = [
  { id: "omnivore",      icon: "🍖" },
  { id: "vegetarian",    icon: "🥦" },
  { id: "pescatarian",   icon: "🐟" },
  { id: "vegan",         icon: "🌱" },
  { id: "keto",          icon: "🥑" },
  { id: "paleo",         icon: "🦴" },
  { id: "mediterranean", icon: "🫒" },
];

export default function OnboardingStep5() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/onboarding/step5`, {
        dietPreferences: selected.map((p) => p.toLowerCase()),
      });
    },
    onSuccess: () => navigation.navigate("Step6"),
  });

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <OnboardingHeader step={5} />
      <View style={s.container}>
        <Text style={s.heading}>{t("onboarding.step5.title")}</Text>
        <Text style={s.subtitle}>{t("onboarding.step5.subtitle")}</Text>

        <View style={s.grid}>
          {DIETS.map((diet) => {
            const isSelected = selected.includes(diet.id);
            return (
              <TouchableOpacity
                key={diet.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(diet.id); }}
                activeOpacity={0.8}
                style={[s.card, isSelected && s.cardActive]}
              >
                <Text style={s.cardIcon}>{diet.icon}</Text>
                <Text style={[s.cardTitle, isSelected && s.cardTitleActive]}>
                  {t(`onboarding.step5.${diet.id}`)}
                </Text>
                <Text style={[s.cardDesc, isSelected && s.cardDescActive]}>{t(`onboarding.step5.${diet.id}_desc`)}</Text>
                {isSelected && (
                  <View style={s.checkBadge}>
                    <Text style={s.checkBadgeText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => submit()}
          disabled={isPending || selected.length === 0}
          style={[s.primaryBtn, (isPending || selected.length === 0) && s.primaryBtnDisabled]}
        >
          {isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[s.primaryBtnText, selected.length === 0 && s.primaryBtnTextMuted]}>
              {selected.length > 0
                ? t("onboarding.step5.continue_selected", { count: selected.length })
                : t("onboarding.step5.select_prompt")}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: "800", color: T.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: T.textSecondary, marginBottom: 24 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 32,
  },
  card: {
    width: "47%",
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
    position: "relative",
  },
  cardActive: { backgroundColor: T.accentDark, borderColor: T.accentBorder },
  cardIcon: { fontSize: 28, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, textAlign: "center" },
  cardTitleActive: { color: T.accent },
  cardDesc: { fontSize: 11, color: T.textMuted, textAlign: "center", lineHeight: 15 },
  cardDescActive: { color: T.accentMuted },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadgeText: { color: "#000", fontSize: 10, fontWeight: "800" },
  primaryBtn: { backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryBtnDisabled: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  primaryBtnTextMuted: { color: T.textMuted },
});
