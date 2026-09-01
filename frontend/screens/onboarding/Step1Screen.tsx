import React, { useState, useRef } from "react";
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import i18n, { LANGUAGE_CODES } from "@/lib/i18n";
import { T } from "@/lib/theme";
import OnboardingHeader from "@/components/OnboardingHeader";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese", "Italian",
  "Dutch", "Russian", "Polish", "Turkish", "Arabic", "Hebrew",
  "Hindi", "Bengali", "Urdu", "Japanese", "Chinese (Simplified)",
  "Chinese (Traditional)", "Korean", "Vietnamese", "Thai", "Indonesian",
  "Malay", "Tagalog", "Swahili", "Afrikaans", "Greek", "Czech",
  "Slovak", "Romanian", "Hungarian", "Swedish", "Norwegian", "Danish",
  "Finnish", "Ukrainian", "Croatian", "Serbian", "Bulgarian",
];

export default function OnboardingStep1() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">("imperial");
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age: "0",
    sex: "" as "male" | "female" | "other",
    lifeStage: null as null | "not_applicable" | "perimenopause" | "menopause" | "postmenopause" | "prefer_not_to_say",
    heightFt: "0",
    heightIn: "0",
    heightCm: "0",
    weightLbs: "0",
    weightKg: "0",
    language: Object.keys(LANGUAGE_CODES).find((name) => LANGUAGE_CODES[name] === i18n.language) ?? "English",
  });

  const ageRef       = useRef<TextInput>(null);
  const heightFtRef  = useRef<TextInput>(null);
  const heightInRef  = useRef<TextInput>(null);
  const heightCmRef  = useRef<TextInput>(null);
  const weightRef    = useRef<TextInput>(null);

  const { mutate: submitStep1, isPending } = useMutation({
    mutationFn: async (data: typeof formData) => {
      let heightCm: number;
      let weightKg: number;

      if (unitSystem === "imperial") {
        heightCm = (parseInt(data.heightFt || "0") * 12 + parseInt(data.heightIn || "0")) * 2.54;
        weightKg = parseFloat(data.weightLbs) * 0.453592;
      } else {
        heightCm = parseFloat(data.heightCm);
        weightKg = parseFloat(data.weightKg);
      }

      const response = await axios.post(`${API_URL}/api/onboarding/step1`, {
        name: data.name,
        age: parseInt(data.age),
        sex: data.sex,
        lifeStage: data.lifeStage ?? undefined,
        height: Math.round(heightCm * 10) / 10,
        weight: Math.round(weightKg * 10) / 10,
        language: data.language,
        unitSystem,
      });
      return response.data;
    },
    onSuccess: () => navigation.navigate("Step2"),
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error.message;
      Alert.alert(t("common.error"), msg);
    },
  });

  const handleNext = () => {
    const heightOk = unitSystem === "imperial" ? !!formData.heightFt : !!formData.heightCm;
    const weightOk = unitSystem === "imperial" ? !!formData.weightLbs : !!formData.weightKg;
    if (!formData.name || !formData.age || !formData.sex || !heightOk || !weightOk) {
      Alert.alert(t("common.error"), t("onboarding.step1.error_fill"));
      return;
    }
    submitStep1(formData);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <OnboardingHeader step={1} showBack={false} />
      <View style={s.container}>
        <Text style={s.heading}>{t("onboarding.step1.title")}</Text>
        <Text style={s.subtitle}>{t("onboarding.step1.subtitle")}</Text>

        {/* Name */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("onboarding.step1.name")}</Text>
          <TextInput
            placeholder={t("onboarding.step1.name_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            returnKeyType="next"
            onSubmitEditing={() => ageRef.current?.focus()}
          />
        </View>

        {/* Age */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("onboarding.step1.age")}</Text>
          <TextInput
            ref={ageRef}
            placeholder={t("onboarding.step1.age_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.input}
            keyboardType="numeric"
            value={formData.age}
            onChangeText={(text) => setFormData({ ...formData, age: text })}
            returnKeyType="next"
            onSubmitEditing={() =>
              unitSystem === "imperial"
                ? heightFtRef.current?.focus()
                : heightCmRef.current?.focus()
            }
          />
        </View>

        {/* Sex */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("onboarding.step1.sex")}</Text>
          <View style={s.chipRow}>
            {(["male", "female", "other"] as const).map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFormData({ ...formData, sex: option }); }}
                style={[s.chip, formData.sex === option && s.chipActive]}
              >
                <Text style={[s.chipText, formData.sex === option && s.chipTextActive]}>
                  {t(`onboarding.step1.${option}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Life stage — optional, only relevant when sex isn't male */}
        {formData.sex && formData.sex !== "male" && (
          <View style={s.fieldGroup}>
            <Text style={s.label}>{t("onboarding.step1.life_stage_label")}</Text>
            <View style={[s.chipRow, { flexWrap: "wrap" }]}>
              {(["not_applicable", "perimenopause", "menopause", "postmenopause", "prefer_not_to_say"] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFormData({ ...formData, lifeStage: option }); }}
                  style={[s.chip, { flexBasis: "48%", flexGrow: 0 }, formData.lifeStage === option && s.chipActive]}
                >
                  <Text style={[s.chipText, formData.lifeStage === option && s.chipTextActive]}>
                    {t(`onboarding.step1.${option}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Units */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("onboarding.step1.units")}</Text>
          <View style={s.segmentTrack}>
            {(["imperial", "metric"] as const).map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnitSystem(u); }}
                style={[s.segmentBtn, unitSystem === u && s.segmentBtnActive]}
              >
                <Text style={[s.segmentText, unitSystem === u && s.segmentTextActive]}>
                  {t(`onboarding.step1.${u}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Height */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("onboarding.step1.height")}</Text>
          {unitSystem === "imperial" ? (
            <View style={s.splitRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  ref={heightFtRef}
                  placeholder={t("onboarding.step1.ft_placeholder")}
                  placeholderTextColor={T.textMuted}
                  style={s.input}
                  keyboardType="numeric"
                  value={formData.heightFt}
                  onChangeText={(text) => setFormData({ ...formData, heightFt: text })}
                  returnKeyType="next"
                  onSubmitEditing={() => heightInRef.current?.focus()}
                />
                <Text style={s.unitHint}>{t("onboarding.step1.ft_placeholder")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  ref={heightInRef}
                  placeholder={t("onboarding.step1.in_placeholder")}
                  placeholderTextColor={T.textMuted}
                  style={s.input}
                  keyboardType="numeric"
                  value={formData.heightIn}
                  onChangeText={(text) => setFormData({ ...formData, heightIn: text })}
                  returnKeyType="next"
                  onSubmitEditing={() => weightRef.current?.focus()}
                />
                <Text style={s.unitHint}>{t("onboarding.step1.in_placeholder")}</Text>
              </View>
            </View>
          ) : (
            <TextInput
              ref={heightCmRef}
              placeholder={t("onboarding.step1.cm_placeholder")}
              placeholderTextColor={T.textMuted}
              style={s.input}
              keyboardType="decimal-pad"
              value={formData.heightCm}
              onChangeText={(text) => setFormData({ ...formData, heightCm: text })}
              returnKeyType="next"
              onSubmitEditing={() => weightRef.current?.focus()}
            />
          )}
        </View>

        {/* Weight */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("onboarding.step1.weight")} ({unitSystem === "imperial" ? "lbs" : "kg"})</Text>
          <TextInput
            ref={weightRef}
            placeholder={unitSystem === "imperial" ? t("onboarding.step1.lbs_placeholder") : t("onboarding.step1.kg_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.input}
            keyboardType="decimal-pad"
            value={unitSystem === "imperial" ? formData.weightLbs : formData.weightKg}
            onChangeText={(text) =>
              setFormData(unitSystem === "imperial"
                ? { ...formData, weightLbs: text }
                : { ...formData, weightKg: text }
              )
            }
            returnKeyType="done"
            onSubmitEditing={handleNext}
          />
        </View>

        {/* Language */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("onboarding.step1.language")}</Text>
          <TouchableOpacity
            onPress={() => setLangModalVisible(true)}
            style={s.langPicker}
          >
            <Text style={s.langPickerText}>{formData.language}</Text>
            <Text style={s.chevron}>▼</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={langModalVisible} animationType="slide" transparent>
          <View style={s.modalBackdrop}>
            <View style={s.modalSheet}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{t("settings.select_language")}</Text>
                <TouchableOpacity onPress={() => setLangModalVisible(false)}>
                  <Text style={s.modalDone}>{t("common.done")}</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={LANGUAGES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={async () => {
                      setFormData({ ...formData, language: item });
                      const code = LANGUAGE_CODES[item];
                      if (code) await i18n.changeLanguage(code);
                      setLangModalVisible(false);
                    }}
                    style={s.langItem}
                  >
                    <Text style={s.langItemText}>{item}</Text>
                    {formData.language === item && <Text style={s.langCheck}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          onPress={handleNext}
          disabled={isPending}
          style={[s.primaryBtn, isPending && s.primaryBtnDisabled]}
        >
          {isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={s.primaryBtnText}>{t("onboarding.step1.button")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: "800", color: T.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: T.textSecondary, marginBottom: 28 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: T.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: T.textPrimary,
    fontSize: 15,
  },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    alignItems: "center",
  },
  chipActive: { backgroundColor: T.accent, borderColor: T.accent },
  chipText: { fontWeight: "600", color: T.textSecondary },
  chipTextActive: { color: "#000" },
  segmentTrack: { flexDirection: "row", backgroundColor: T.surface, borderRadius: 12, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  segmentBtnActive: { backgroundColor: T.accent },
  segmentText: { fontSize: 13, fontWeight: "600", color: T.textSecondary },
  segmentTextActive: { color: "#000" },
  splitRow: { flexDirection: "row", gap: 12 },
  unitHint: { fontSize: 11, color: T.textMuted, textAlign: "center", marginTop: 4 },
  hint: { fontSize: 11, color: T.textMuted, marginTop: 6 },
  langPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  langPickerText: { fontSize: 15, color: T.textPrimary },
  chevron: { color: T.textMuted, fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: T.border,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: T.textPrimary },
  modalDone: { fontSize: 15, color: T.accent, fontWeight: "600" },
  langItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  langItemText: { fontSize: 15, color: T.textPrimary },
  langCheck: { fontSize: 16, color: T.accent, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnDisabled: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
});
