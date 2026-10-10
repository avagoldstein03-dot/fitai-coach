import React, { useState } from "react";
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
import {
  SEXES,
  LIFE_STAGES,
  ACTIVITY_LEVELS,
  FITNESS_EXPERIENCE_LEVELS,
  sexKey,
  lifeStageKey,
  activityKey,
  activityDescKey,
  experienceKey,
  showsLifeStage,
} from "@/lib/profile-options";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface ProfileData {
  name: string | null;
  height: number | null; // cm
  weight: number | null; // kg
  age: number | null;
  unitSystem: "imperial" | "metric";
  // Collected at onboarding and, until now, frozen there. Each one feeds a
  // calculation: sex branches the BMR formula, activityLevel multiplies it,
  // lifeStage adds the menopause protein bump, and fitnessExperience decides
  // how the coach talks and how the program is built.
  sex: string | null;
  lifeStage: string | null;
  activityLevel: string | null;
  fitnessExperience: string | null;
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

  const [name, setName] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<string | null>(null);
  const [lifeStage, setLifeStage] = useState<string | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [fitnessExperience, setFitnessExperience] = useState<string | null>(null);

  // Seeded during render rather than from an effect, guarded by a marker of the
  // server values the fields were last filled from. The effect version wrote
  // state as a side effect of rendering anyway — this does it in one pass
  // instead of a render, an effect and a second render, and it is the pattern
  // the Settings screen already uses for the same job.
  const [syncedFrom, setSyncedFrom] = useState<string | undefined>(undefined);
  const serverValues = profile
    ? JSON.stringify([
        profile.name, profile.height, profile.weight, profile.age,
        profile.sex, profile.lifeStage, profile.activityLevel, profile.fitnessExperience,
        isImperial,
      ])
    : undefined;

  if (serverValues !== undefined && serverValues !== syncedFrom) {
    setSyncedFrom(serverValues);
    if (profile!.name) setName(profile!.name);
    if (profile!.sex) setSex(profile!.sex);
    if (profile!.lifeStage) setLifeStage(profile!.lifeStage);
    if (profile!.activityLevel) setActivityLevel(profile!.activityLevel);
    if (profile!.fitnessExperience) setFitnessExperience(profile!.fitnessExperience);
    if (profile!.height != null) {
      if (isImperial) {
        const { ft, in: inch } = cmToFtIn(profile!.height);
        setHeightFt(String(ft));
        setHeightIn(String(inch));
      } else {
        setHeightCm(String(Math.round(profile!.height)));
      }
    }
    if (profile!.weight != null) {
      setWeight(isImperial ? String(Math.round(kgToLbs(profile!.weight))) : String(Math.round(profile!.weight * 10) / 10));
    }
    if (profile!.age != null) setAge(String(profile!.age));
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const heightCmValue = isImperial
        ? ftInToCm(parseInt(heightFt || "0", 10), parseInt(heightIn || "0", 10))
        : parseFloat(heightCm || "0");
      const weightKgValue = isImperial ? lbsToKg(parseFloat(weight || "0")) : parseFloat(weight || "0");

      await axios.patch(`${API_URL}/api/auth/profile`, {
        name: name.trim(),
        height: Math.round(heightCmValue * 10) / 10,
        weight: Math.round(weightKgValue * 10) / 10,
        age: parseInt(age || "0", 10),
        // Only sent when set, so opening this screen and saving cannot blank
        // an answer the user never touched.
        ...(sex ? { sex } : {}),
        ...(lifeStage && showsLifeStage(sex) ? { lifeStage } : {}),
        ...(activityLevel ? { activityLevel } : {}),
        ...(fitnessExperience ? { fitnessExperience } : {}),
      });
    },
    onSuccess: () => {
      // Every one of these feeds the calorie maths, so the cached targets are
      // stale the moment they change.
      for (const key of [
        ["profile"],
        ["dashboard"],
        ["nutritionTargets"],
        ["goal"],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      navigation.goBack();
    },
    onError: () => {
      Alert.alert(t("common.error"), t("edit_profile.error_save"));
    },
  });

  const heightOk = isImperial ? !!heightFt : !!heightCm;
  const canSave = !!name.trim() && heightOk && !!weight && !!age && !isPending;

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
            <Text style={s.label}>{t("edit_profile.name")}</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder={t("edit_profile.name")}
              placeholderTextColor={T.textMuted}
              autoCapitalize="words"
            />
          </View>

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

          <View style={s.card}>
            <Text style={s.label}>{t("onboarding.step1.sex")}</Text>
            <View style={s.chipWrap}>
              {SEXES.map((id) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setSex(id)}
                  style={[s.chip, sex === id && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sex === id }}
                >
                  <Text style={[s.chipText, sex === id && s.chipTextOn]}>{t(sexKey(id))}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Same rule as onboarding step 1: only asked when sex is not male. */}
          {showsLifeStage(sex) && (
            <View style={s.card}>
              <Text style={s.label}>{t("onboarding.step1.life_stage_label")}</Text>
              <View style={s.chipWrap}>
                {LIFE_STAGES.map((id) => (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setLifeStage(id)}
                    style={[s.chip, lifeStage === id && s.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: lifeStage === id }}
                  >
                    <Text style={[s.chipText, lifeStage === id && s.chipTextOn]}>
                      {t(lifeStageKey(id))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* The single biggest lever on the calorie target — the TDEE
              multiplier runs 1.2 to 1.725 across these four. Someone whose
              activity changed had no way to correct it. */}
          <View style={s.card}>
            <Text style={s.label}>{t("onboarding.step3.title")}</Text>
            <View style={s.optionList}>
              {ACTIVITY_LEVELS.map((id) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setActivityLevel(id)}
                  style={[s.optionRow, activityLevel === id && s.optionRowOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activityLevel === id }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionTitle, activityLevel === id && s.chipTextOn]}>
                      {t(activityKey(id))}
                    </Text>
                    <Text style={s.optionDesc}>{t(activityDescKey(id))}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.label}>{t("onboarding.step4.title")}</Text>
            <View style={s.chipWrap}>
              {FITNESS_EXPERIENCE_LEVELS.map((id) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setFitnessExperience(id)}
                  style={[s.chip, fitnessExperience === id && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: fitnessExperience === id }}
                >
                  <Text style={[s.chipText, fitnessExperience === id && s.chipTextOn]}>
                    {t(experienceKey(id))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: T.accentDark, borderColor: T.accent },
  chipText: { fontSize: 13, color: T.textSecondary, fontWeight: "600" },
  chipTextOn: { color: T.accent },
  // Activity level gets rows rather than chips: the descriptions are the part
  // that makes the four distinguishable, and they do not fit in a chip.
  optionList: { gap: 8 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface2,
  },
  optionRowOn: { backgroundColor: T.accentDark, borderColor: T.accent },
  optionTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 2 },
  optionDesc: { fontSize: 11.5, color: T.textMuted, lineHeight: 16 },
  saveBtn: { marginHorizontal: 20, backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  saveBtnDisabled: { backgroundColor: T.surface },
  saveBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
