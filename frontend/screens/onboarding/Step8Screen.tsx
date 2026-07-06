import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import OnboardingHeader from "@/components/OnboardingHeader";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type AssessmentMethod = "photo" | "manual" | "";

export default function OnboardingStep8() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [selected, setSelected] = useState<AssessmentMethod>("");

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async (method: AssessmentMethod) => {
      await axios.post(`${API_URL}/api/onboarding/step8`, { assessmentMethod: method });
    },
    onSuccess: (_data, method) => {
      if (method === "photo") navigation.navigate("BodyScan");
      else if (method === "manual") navigation.navigate("ManualMeasurements");
      else navigation.navigate("Main");
    },
    onError: () => navigation.navigate("Main"),
  });

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <OnboardingHeader step={8} />
      <View style={s.container}>
        <Text style={s.heading}>{t("onboarding.step8.title")}</Text>
        <Text style={s.step}>{t("onboarding.step8.step_label")}</Text>
        <Text style={s.subtitle}>{t("onboarding.step8.subtitle")}</Text>

        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelected("photo"); }}
          style={[s.optionCard, selected === "photo" && s.optionCardActive]}
        >
          <Text style={[s.optionTitle, selected === "photo" && s.optionTitleActive]}>{t("onboarding.step8.scan_title")}</Text>
          <Text style={[s.optionDesc, selected === "photo" && s.optionDescActive]}>
            {t("onboarding.step8.scan_desc")}
          </Text>
          {selected === "photo" && (
            <Text style={s.selectedNote}>{t("onboarding.step8.scan_note")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelected("manual"); }}
          style={[s.optionCard, selected === "manual" && s.optionCardActive]}
        >
          <Text style={[s.optionTitle, selected === "manual" && s.optionTitleActive]}>{t("onboarding.step8.manual_title")}</Text>
          <Text style={[s.optionDesc, selected === "manual" && s.optionDescActive]}>
            {t("onboarding.step8.manual_desc")}
          </Text>
          {selected === "manual" && (
            <Text style={s.selectedNote}>{t("onboarding.step8.manual_note")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("Main")}
          style={s.skipBtn}
        >
          <Text style={s.skipBtnText}>{t("onboarding.step8.skip")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => selected && submit(selected)}
          disabled={isPending || !selected}
          style={[s.primaryBtn, !selected && s.primaryBtnDisabled]}
        >
          {isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[s.primaryBtnText, !selected && s.primaryBtnTextDisabled]}>
              {selected === "photo"
                ? t("onboarding.step8.start_scan")
                : selected === "manual"
                ? t("onboarding.step8.enter_measurements")
                : t("onboarding.step8.select_option")}
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
  heading: { fontSize: 28, fontWeight: "800", color: T.textPrimary, marginBottom: 4 },
  step: { fontSize: 13, color: T.textMuted, marginBottom: 4 },
  subtitle: { fontSize: 14, color: T.textSecondary, marginBottom: 24, lineHeight: 20 },
  optionCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    marginBottom: 12,
  },
  optionCardActive: { backgroundColor: T.accent, borderColor: T.accent },
  optionTitle: { fontSize: 18, fontWeight: "700", color: T.textPrimary, marginBottom: 8 },
  optionTitleActive: { color: "#000" },
  optionDesc: { fontSize: 14, color: T.textSecondary, lineHeight: 20 },
  optionDescActive: { color: "#000" },
  selectedNote: { fontSize: 12, color: "#000", marginTop: 8, fontWeight: "600" },
  skipBtn: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    marginBottom: 20,
  },
  skipBtnText: { color: T.textSecondary, fontSize: 14 },
  primaryBtn: { backgroundColor: T.accent, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  primaryBtnDisabled: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  primaryBtnTextDisabled: { color: T.textMuted },
});
