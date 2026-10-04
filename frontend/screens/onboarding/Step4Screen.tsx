import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import OnboardingHeader from "@/components/OnboardingHeader";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Mirrors MEDICAL_CONDITIONS in backend/lib/medical-conditions.ts. The backend
// rejects anything not on that list, so these ids must stay in step with it.
const CONDITIONS = [
  "high_blood_pressure", "heart_condition", "diabetes_type_1", "diabetes_type_2",
  "asthma", "pcos", "thyroid", "joint_condition", "pregnant_or_postpartum",
  "disordered_eating_history", "prefer_not_to_say",
] as const;

const LEVELS: { id: string; icon: string; color: string; bg: string; border: string }[] = [
  { id: "beginner",     icon: "🌱", color: T.teal,   bg: T.tealDark,   border: T.tealBorder   },
  { id: "intermediate", icon: "🏋️", color: T.blue,   bg: T.blueDark,   border: T.blueBorder   },
  { id: "advanced",     icon: "⚡", color: T.accent, bg: T.accentDark, border: T.accentBorder },
];

export default function OnboardingStep4() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>("");
  const [injuryHistory, setInjuryHistory] = useState<string>("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [medicalNotes, setMedicalNotes] = useState<string>("");

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/onboarding/step4`, {
        fitnessExperience: selected,
        injuryHistory: injuryHistory.trim() || undefined,
        medicalConditions: conditions.length ? conditions : undefined,
        medicalNotes: medicalNotes.trim() || undefined,
      });
    },
    onSuccess: () => navigation.navigate("Step5"),
  });

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <OnboardingHeader step={4} />
      <View style={s.container}>
        <Text style={s.heading}>{t("onboarding.step4.title")}</Text>
        <Text style={s.subtitle}>{t("onboarding.step4.subtitle")}</Text>

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
                    {t(`onboarding.step4.${level.id}`)}
                  </Text>
                  <Text style={[s.optionDesc, isSelected && { color: level.color + "bb" }]}>{t(`onboarding.step4.${level.id}_desc`)}</Text>
                </View>
                <View style={[s.checkCircle, isSelected && { backgroundColor: level.color, borderColor: level.color }]}>
                  {isSelected && <Text style={s.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.injuryLabel}>{t("onboarding.step4.injury_label")}</Text>
        <TextInput
          placeholder={t("onboarding.step4.injury_placeholder")}
          placeholderTextColor={T.textMuted}
          style={s.textArea}
          multiline
          numberOfLines={3}
          value={injuryHistory}
          onChangeText={setInjuryHistory}
        />
        <Text style={s.injuryHelper}>{t("onboarding.step4.injury_helper")}</Text>

        <Text style={s.injuryLabel}>{t("onboarding.step4.medical_label")}</Text>
        <View style={s.conditionWrap}>
          {CONDITIONS.map((id) => {
            const on = conditions.includes(id);
            return (
              <TouchableOpacity
                key={id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setConditions((prev) =>
                    // "Prefer not to say" is an answer, not an addition — picking it
                    // clears the rest, and picking anything else clears it.
                    id === "prefer_not_to_say"
                      ? (prev.includes(id) ? [] : [id])
                      : prev.includes(id)
                        ? prev.filter((x) => x !== id)
                        : [...prev.filter((x) => x !== "prefer_not_to_say"), id]
                  );
                }}
                style={[s.conditionChip, on && s.conditionChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.conditionChipText, on && s.conditionChipTextOn]}>
                  {t(`onboarding.step4.condition_${id}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {conditions.length > 0 && !conditions.includes("prefer_not_to_say") && (
          <TextInput
            placeholder={t("onboarding.step4.medical_notes_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.textArea}
            multiline
            numberOfLines={2}
            maxLength={300}
            value={medicalNotes}
            onChangeText={setMedicalNotes}
          />
        )}
        <Text style={s.injuryHelper}>{t("onboarding.step4.medical_helper")}</Text>

        <TouchableOpacity
          onPress={() => submit()}
          disabled={isPending || !selected}
          style={[s.primaryBtn, (!selected || isPending) && s.primaryBtnDisabled]}
        >
          {isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[s.primaryBtnText, !selected && s.primaryBtnTextMuted]}>
              {selected ? t("common.continue") : t("onboarding.step4.prompt")}
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
  injuryLabel: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 8 },
  textArea: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: T.textPrimary,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  injuryHelper: { fontSize: 12, color: T.textMuted, marginTop: 6, marginBottom: 32 },
  conditionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  conditionChip: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  conditionChipOn: { backgroundColor: T.accentDark, borderColor: T.accent },
  conditionChipText: { fontSize: 13, color: T.textSecondary, fontWeight: "600" },
  conditionChipTextOn: { color: T.accent },
  primaryBtn: { backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryBtnDisabled: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  primaryBtnTextMuted: { color: T.textMuted },
});
