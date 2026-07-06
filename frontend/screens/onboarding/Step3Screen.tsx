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

const LEVELS: { id: string; icon: string; color: string; bg: string; border: string }[] = [
  { id: "sedentary",         icon: "🛋️", color: T.blue,   bg: T.blueDark,   border: T.blueBorder },
  { id: "lightly_active",    icon: "🚶", color: T.teal,   bg: T.tealDark,   border: T.tealBorder },
  { id: "moderately_active", icon: "🏃", color: T.amber,  bg: T.amberDark,  border: T.amberBorder },
  { id: "very_active",       icon: "⚡", color: T.accent, bg: T.accentDark, border: T.accentBorder },
];

export default function OnboardingStep3() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>("");

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/onboarding/step3`, { activityLevel: selected });
    },
    onSuccess: () => navigation.navigate("Step4"),
  });

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <OnboardingHeader step={3} />
      <View style={s.container}>
        <Text style={s.heading}>{t("onboarding.step3.title")}</Text>
        <Text style={s.subtitle}>{t("onboarding.step3.subtitle")}</Text>

        <View style={s.optionList}>
          {LEVELS.map((level) => {
            const isSelected = selected === level.id;
            return (
              <TouchableOpacity
                key={level.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelected(level.id); }}
                activeOpacity={0.8}
                style={[s.option, isSelected && { backgroundColor: level.bg, borderColor: level.border }]}
              >
                <View style={[s.iconCircle, { backgroundColor: level.color + "22" }]}>
                  <Text style={s.iconEmoji}>{level.icon}</Text>
                </View>
                <View style={s.optionBody}>
                  <Text style={[s.optionTitle, isSelected && { color: level.color }]}>
                    {t(`onboarding.step3.${level.id}`)}
                  </Text>
                  <Text style={[s.optionDesc, isSelected && { color: level.color + "bb" }]}>
                    {t(`onboarding.step3.${level.id}_desc`)}
                  </Text>
                </View>
                <View style={[s.checkCircle, isSelected && { backgroundColor: level.color, borderColor: level.color }]}>
                  {isSelected && <Text style={s.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => selected && submit()}
          disabled={isPending || !selected}
          style={[s.primaryBtn, (!selected || isPending) && s.primaryBtnDisabled]}
        >
          {isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[s.primaryBtnText, !selected && s.primaryBtnTextMuted]}>
              {selected ? t("common.continue") : t("onboarding.step3.prompt")}
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
