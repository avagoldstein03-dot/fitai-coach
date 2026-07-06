import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import OnboardingHeader from "@/components/OnboardingHeader";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const GOALS: { id: string; icon: string; color: string; bg: string; border: string }[] = [
  { id: "fat_loss",             icon: "⚡", color: T.amber,  bg: T.amberDark,  border: T.amberBorder  },
  { id: "muscle_gain",          icon: "💪", color: T.blue,   bg: T.blueDark,   border: T.blueBorder   },
  { id: "recomposition",        icon: "⚖️", color: T.teal,   bg: T.tealDark,   border: T.tealBorder   },
  { id: "athletic_performance", icon: "🏃", color: T.green,  bg: T.greenDark,  border: T.greenBorder  },
  { id: "general_health",       icon: "❤️", color: T.accent, bg: T.accentDark, border: T.accentBorder },
];

export default function OnboardingStep2() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [selectedGoal, setSelectedGoal] = useState<string>("");

  const { mutate: submitStep2, isPending } = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`${API_URL}/api/onboarding/step2`, { primaryGoal: selectedGoal });
      return response.data;
    },
    onSuccess: () => navigation.navigate("Step3"),
  });

  const handleNext = () => {
    if (!selectedGoal) { Alert.alert(t("common.error"), t("onboarding.step2.error_select")); return; }
    submitStep2();
  };

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <OnboardingHeader step={2} />
      <View style={s.container}>
        <Text style={s.heading}>{t("onboarding.step2.title")}</Text>
        <Text style={s.subtitle}>{t("onboarding.step2.subtitle")}</Text>

        <View style={s.optionList}>
          {GOALS.map((goal) => {
            const isSelected = selectedGoal === goal.id;
            return (
              <TouchableOpacity
                key={goal.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedGoal(goal.id); }}
                activeOpacity={0.8}
                style={[s.option, isSelected && { backgroundColor: goal.bg, borderColor: goal.border }]}
              >
                <View style={[s.iconCircle, { backgroundColor: goal.color + "22" }]}>
                  <Text style={s.iconEmoji}>{goal.icon}</Text>
                </View>
                <View style={s.optionBody}>
                  <Text style={[s.optionTitle, isSelected && { color: goal.color }]}>
                    {t(`onboarding.step2.${goal.id}`)}
                  </Text>
                  <Text style={[s.optionDesc, isSelected && { color: goal.color + "bb" }]}>{t(`onboarding.step2.${goal.id}_desc`)}</Text>
                </View>
                <View style={[s.checkCircle, isSelected && { backgroundColor: goal.color, borderColor: goal.color }]}>
                  {isSelected && <Text style={s.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={handleNext}
          disabled={isPending || !selectedGoal}
          style={[s.primaryBtn, (!selectedGoal || isPending) && s.primaryBtnDisabled]}
        >
          {isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[s.primaryBtnText, !selectedGoal && s.primaryBtnTextMuted]}>
              {selectedGoal ? t("common.continue") : t("onboarding.step2.select_prompt")}
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
  optionList: { gap: 10, marginBottom: 32 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  optionBody: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 2 },
  optionDesc: { fontSize: 12, color: T.textMuted, lineHeight: 17 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkMark: { color: "#000", fontSize: 11, fontWeight: "800" },
  primaryBtn: { backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryBtnDisabled: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  primaryBtnTextMuted: { color: T.textMuted },
});
