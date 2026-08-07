import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";

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

interface ProfileData {
  dietPreferences?: string[];
  foodAllergies?: string[];
}

export default function EditDietScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [allergies, setAllergies] = useState("");

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    if (profile.dietPreferences) setSelected(profile.dietPreferences);
    if (profile.foodAllergies) setAllergies(profile.foodAllergies.join(", "));
  }, [profile]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      await axios.patch(`${API_URL}/api/auth/profile`, {
        dietPreferences: selected,
        foodAllergies: allergies ? allergies.split(",").map((a) => a.trim()).filter(Boolean) : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      navigation.goBack();
    },
    onError: () => Alert.alert(t("common.error"), t("edit_diet.error_save")),
  });

  if (isLoading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>{t("common.back")}</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t("edit_diet.title")}</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.sectionLabel}>{t("onboarding.step5.title")}</Text>
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
                  <Text style={[s.cardTitle, isSelected && s.cardTitleActive]}>{t(`onboarding.step5.${diet.id}`)}</Text>
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

          <Text style={s.sectionLabel}>{t("onboarding.step6.title")}</Text>
          <TextInput
            placeholder={t("onboarding.step6.placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.textArea}
            multiline
            numberOfLines={4}
            value={allergies}
            onChangeText={setAllergies}
          />

          <TouchableOpacity
            onPress={() => save()}
            disabled={selected.length === 0 || isPending}
            style={[s.saveBtn, (selected.length === 0 || isPending) && s.saveBtnDisabled]}
          >
            {isPending ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>{t("common.save")}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  backBtn: { marginRight: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: T.textSecondary, marginTop: 8, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
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
  textArea: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: T.textPrimary,
    fontSize: 15,
    marginBottom: 24,
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveBtn: { backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: T.surface },
  saveBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
