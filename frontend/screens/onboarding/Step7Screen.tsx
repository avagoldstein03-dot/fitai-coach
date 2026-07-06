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

export default function OnboardingStep7() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [history, setHistory] = useState<string>("");

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/onboarding/step7`, {
        supplementHistory: history ? history.split(",").map((h) => h.trim()) : [],
      });
    },
    onSuccess: () => navigation.navigate("Step8"),
  });

  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <OnboardingHeader step={7} />
      <View style={s.container}>
        <Text style={s.heading}>{t("onboarding.step7.title")}</Text>
        <Text style={s.subtitle}>{t("onboarding.step7.subtitle")}</Text>
        <TextInput
          placeholder={t("onboarding.step7.placeholder")}
          placeholderTextColor={T.textMuted}
          style={s.textArea}
          multiline
          numberOfLines={4}
          value={history}
          onChangeText={setHistory}
        />
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); submit(); }}
          disabled={isPending}
          style={[s.primaryBtn, isPending && s.primaryBtnDisabled]}
        >
          {isPending ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>{t("common.continue")}</Text>}
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
  textArea: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: T.textPrimary,
    fontSize: 15,
    marginBottom: 32,
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryBtn: { backgroundColor: T.accent, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  primaryBtnDisabled: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
});
