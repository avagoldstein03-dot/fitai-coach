import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const GOALS: { id: string; icon: string; color: string; bg: string; border: string }[] = [
  { id: "fat_loss",             icon: "⚡", color: T.amber,  bg: T.amberDark,  border: T.amberBorder  },
  { id: "muscle_gain",          icon: "💪", color: T.blue,   bg: T.blueDark,   border: T.blueBorder   },
  { id: "recomposition",        icon: "⚖️", color: T.teal,   bg: T.tealDark,   border: T.tealBorder   },
  { id: "athletic_performance", icon: "🏃", color: T.green,  bg: T.greenDark,  border: T.greenBorder  },
  { id: "general_health",       icon: "❤️", color: T.accent, bg: T.accentDark, border: T.accentBorder },
];

export default function EditGoalScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [selectedGoal, setSelectedGoal] = useState("");

  const { data, isLoading } = useQuery<{ goal: { primaryGoal: string } | null }>({
    queryKey: ["goal"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/goal`);
      return res.data.data;
    },
  });

  useEffect(() => {
    if (data?.goal?.primaryGoal) setSelectedGoal(data.goal.primaryGoal);
  }, [data]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      await axios.patch(`${API_URL}/api/goal`, { primaryGoal: selectedGoal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goal"] });
      navigation.goBack();
    },
    onError: () => Alert.alert(t("common.error"), t("edit_goal.error_save")),
  });

  if (isLoading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("edit_goal.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
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
          onPress={() => save()}
          disabled={!selectedGoal || isPending}
          style={[s.saveBtn, (!selectedGoal || isPending) && s.saveBtnDisabled]}
        >
          {isPending ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>{t("common.save")}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  backBtn: { marginRight: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary },
  optionList: { gap: 10, marginTop: 8, marginBottom: 24 },
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
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
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
  saveBtn: { backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: T.surface },
  saveBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
