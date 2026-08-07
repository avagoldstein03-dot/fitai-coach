import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
import { T } from "@/lib/theme";
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg } from "@/lib/units";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface ProfileData {
  height: number | null; // cm
  weight: number | null; // kg
  age: number | null;
  unitSystem: "imperial" | "metric";
}

export default function EditProfileScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
  });

  const isImperial = (profile?.unitSystem ?? "imperial") === "imperial";

  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");

  useEffect(() => {
    if (!profile) return;
    if (profile.height != null) {
      if (isImperial) {
        const { ft, in: inch } = cmToFtIn(profile.height);
        setHeightFt(String(ft));
        setHeightIn(String(inch));
      } else {
        setHeightCm(String(Math.round(profile.height)));
      }
    }
    if (profile.weight != null) {
      setWeight(isImperial ? String(Math.round(kgToLbs(profile.weight))) : String(Math.round(profile.weight * 10) / 10));
    }
    if (profile.age != null) setAge(String(profile.age));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const heightCmValue = isImperial
        ? ftInToCm(parseInt(heightFt || "0", 10), parseInt(heightIn || "0", 10))
        : parseFloat(heightCm || "0");
      const weightKgValue = isImperial ? lbsToKg(parseFloat(weight || "0")) : parseFloat(weight || "0");

      await axios.patch(`${API_URL}/api/auth/profile`, {
        height: Math.round(heightCmValue * 10) / 10,
        weight: Math.round(weightKgValue * 10) / 10,
        age: parseInt(age || "0", 10),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigation.goBack();
    },
    onError: () => {
      Alert.alert(t("common.error"), t("edit_profile.error_save"));
    },
  });

  const heightOk = isImperial ? !!heightFt : !!heightCm;
  const canSave = heightOk && !!weight && !!age && !isPending;

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
          <Text style={s.headerTitle}>{t("edit_profile.title")}</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <Text style={s.label}>{t("edit_profile.height")}</Text>
            {isImperial ? (
              <View style={s.row}>
                <View style={s.rowItem}>
                  <TextInput
                    style={s.input}
                    keyboardType="number-pad"
                    value={heightFt}
                    onChangeText={setHeightFt}
                    placeholder="5"
                    placeholderTextColor={T.textMuted}
                  />
                  <Text style={s.unitLabel}>{t("edit_profile.feet")}</Text>
                </View>
                <View style={s.rowItem}>
                  <TextInput
                    style={s.input}
                    keyboardType="number-pad"
                    value={heightIn}
                    onChangeText={setHeightIn}
                    placeholder="7"
                    placeholderTextColor={T.textMuted}
                  />
                  <Text style={s.unitLabel}>{t("edit_profile.inches")}</Text>
                </View>
              </View>
            ) : (
              <TextInput
                style={s.input}
                keyboardType="number-pad"
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="170"
                placeholderTextColor={T.textMuted}
              />
            )}
          </View>

          <View style={s.card}>
            <Text style={s.label}>{t("edit_profile.weight")}</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              placeholder={isImperial ? "150" : "68"}
              placeholderTextColor={T.textMuted}
            />
            <Text style={s.unitLabel}>{isImperial ? t("edit_profile.lbs") : t("edit_profile.kg")}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>{t("edit_profile.age")}</Text>
            <TextInput
              style={s.input}
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              placeholder="30"
              placeholderTextColor={T.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
            onPress={() => save()}
            disabled={!canSave}
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
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
  },
  label: { fontSize: 13, fontWeight: "700", color: T.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  input: {
    backgroundColor: T.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: T.textPrimary,
  },
  unitLabel: { fontSize: 12, color: T.textMuted, marginTop: 6, textAlign: "center" },
  saveBtn: { marginHorizontal: 20, backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  saveBtnDisabled: { backgroundColor: T.surface },
  saveBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
