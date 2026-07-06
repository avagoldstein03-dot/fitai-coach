import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";
import { cmToInches, inchesToCm } from "@/lib/units";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface Measurement {
  waist: string;
  neck: string;
  hips: string;
  chest: string;
  thighs: string;
  arms: string;
}

interface MeasurementField {
  key: keyof Measurement;
  required: boolean;
}

const fields: MeasurementField[] = [
  { key: "chest",  required: true },
  { key: "waist",  required: true },
  { key: "hips",   required: true },
  { key: "neck",   required: true },
  { key: "thighs", required: false },
  { key: "arms",   required: false },
];

function ResultCard({ estimatedBodyFat }: { estimatedBodyFat: number }) {
  const { t } = useTranslation();
  const category =
    estimatedBodyFat < 10 ? t("manual_measurements.category_essential_fat")
    : estimatedBodyFat < 18 ? t("manual_measurements.category_athletic")
    : estimatedBodyFat < 25 ? t("manual_measurements.category_fitness")
    : estimatedBodyFat < 32 ? t("manual_measurements.category_average")
    : t("manual_measurements.category_obese");

  const color =
    estimatedBodyFat < 18 ? T.green
    : estimatedBodyFat < 25 ? T.blue
    : estimatedBodyFat < 32 ? T.amber
    : T.red;

  return (
    <View style={s.resultCard}>
      <Text style={s.resultLabel}>{t("manual_measurements.result_title")}</Text>
      <Text style={[s.resultValue, { color }]}>{estimatedBodyFat}%</Text>
      <Text style={[s.resultCategory, { color }]}>{category}</Text>
      <Text style={s.resultNote}>{t("manual_measurements.result_note")}</Text>
    </View>
  );
}

export default function ManualMeasurementsScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { isSignedIn } = useAuth();

  const [measurements, setMeasurements] = useState<Measurement>({
    waist: "", neck: "", hips: "", chest: "", thighs: "", arms: "",
  });
  const inputRefs = useRef<Partial<Record<keyof Measurement, TextInput | null>>>({});

  const { data: existingData, isLoading: isLoadingExisting, refetch: refetchExisting, isRefetching: isRefetchingExisting } = useQuery({
    queryKey: ["manual-measurement"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/assessment/manual`);
      return res.data?.data;
    },
    enabled: isSignedIn,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data?.data;
    },
    enabled: isSignedIn,
  });

  const unitSystem = profile?.unitSystem ?? "imperial";
  const lengthUnitLabel = unitSystem === "metric" ? "cm" : "in";

  useEffect(() => {
    const m = existingData?.measurement;
    if (m) {
      const toDisplay = (cm: number | null) =>
        cm == null ? "" : String(Math.round((unitSystem === "metric" ? cm : cmToInches(cm)) * 10) / 10);
      setMeasurements({
        waist:  toDisplay(m.waist),
        neck:   toDisplay(m.neck),
        hips:   toDisplay(m.hips),
        chest:  toDisplay(m.chest),
        thighs: toDisplay(m.thighs),
        arms:   toDisplay(m.arms),
      });
    }
  }, [existingData, unitSystem]);

  const { mutate: saveMeasurements, isPending, data: savedData } = useMutation({
    mutationFn: async () => {
      const toCm = (val: string) =>
        unitSystem === "metric" ? parseFloat(val) : inchesToCm(parseFloat(val));

      const body: Record<string, number> = {};
      if (measurements.waist)  body.waist  = toCm(measurements.waist);
      if (measurements.neck)   body.neck   = toCm(measurements.neck);
      if (measurements.hips)   body.hips   = toCm(measurements.hips);
      if (measurements.chest)  body.chest  = toCm(measurements.chest);
      if (measurements.thighs) body.thighs = toCm(measurements.thighs);
      if (measurements.arms)   body.arms   = toCm(measurements.arms);

      const res = await axios.post(`${API_URL}/api/assessment/manual`, body);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-measurement"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message ?? t("manual_measurements.error_save");
      Alert.alert(t("common.error"), msg);
    },
  });

  const validate = () => {
    if (!measurements.waist || !measurements.chest || !measurements.hips || !measurements.neck) {
      Alert.alert(t("manual_measurements.error_required_title"), t("manual_measurements.error_required_msg"));
      return false;
    }
    return true;
  };

  const resultBodyFat = savedData?.estimatedBodyFat ?? existingData?.measurement?.estimatedBodyFat;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: T.bg }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetchingExisting} onRefresh={refetchExisting} tintColor={T.accent} />}
      >
        <View style={s.container}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
            <Text style={s.backText}>{t("common.back")}</Text>
          </TouchableOpacity>
          <Text style={s.heading}>{t("manual_measurements.title")}</Text>
          <Text style={s.subtitle}>{t("manual_measurements.subtitle")}</Text>

          {resultBodyFat != null && <ResultCard estimatedBodyFat={resultBodyFat} />}

          {fields.map((field, i) => (
            <View key={field.key} style={s.fieldGroup}>
              <View style={s.labelRow}>
                <Text style={s.label}>{t(`manual_measurements.field_${field.key}_label`)}</Text>
                {field.required && <Text style={s.required}> *</Text>}
              </View>
              <Text style={s.hint}>{t(`manual_measurements.field_${field.key}_hint`)}</Text>
              <View style={s.inputRow}>
                <TextInput
                  ref={(el) => { inputRefs.current[field.key] = el; }}
                  value={measurements[field.key]}
                  onChangeText={(val) =>
                    setMeasurements((prev) => ({ ...prev, [field.key]: val }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor={T.textMuted}
                  style={s.input}
                  returnKeyType={i < fields.length - 1 ? "next" : "done"}
                  onSubmitEditing={() => {
                    if (i < fields.length - 1) {
                      inputRefs.current[fields[i + 1].key]?.focus();
                    } else {
                      validate() && saveMeasurements();
                    }
                  }}
                />
                <Text style={s.unitLabel}>{lengthUnitLabel}</Text>
              </View>
            </View>
          ))}

          <View style={s.guideCard}>
            <Text style={s.guideTitle}>{t("manual_measurements.guide_title")}</Text>
            {(t("manual_measurements.guide_items", { returnObjects: true }) as Array<{ label: string; tip: string }>).map((item) => (
              <View key={item.label} style={s.guideItem}>
                <Text style={s.guideItemLabel}>{item.label}</Text>
                <Text style={s.guideItemTip}>{item.tip}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => validate() && saveMeasurements()}
            disabled={isPending || isLoadingExisting}
            style={[s.primaryBtn, isPending && s.primaryBtnDisabled]}
          >
            {isPending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.primaryBtnText}>
                {resultBodyFat != null ? t("manual_measurements.update") : t("manual_measurements.calculate")}
              </Text>
            )}
          </TouchableOpacity>

          {resultBodyFat != null && (
            <TouchableOpacity
              onPress={() => navigation.navigate("AssessmentResults")}
              style={s.secondaryBtn}
            >
              <Text style={s.secondaryBtnText}>{t("assessment.view_full")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  heading: { fontSize: 26, fontWeight: "800", color: T.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 13, color: T.textSecondary, lineHeight: 19, marginBottom: 24 },
  resultCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 24,
  },
  resultLabel: { fontSize: 12, color: T.textMuted, marginBottom: 4 },
  resultValue: { fontSize: 48, fontWeight: "800" },
  resultCategory: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  resultNote: { fontSize: 11, color: T.textMuted },
  fieldGroup: { marginBottom: 18 },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  label: { fontSize: 14, fontWeight: "600", color: T.textPrimary },
  required: { fontSize: 13, color: T.red },
  hint: { fontSize: 11, color: T.textMuted, marginBottom: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
  },
  input: { flex: 1, color: T.textPrimary, fontSize: 15, paddingVertical: 13 },
  unitLabel: { fontSize: 13, color: T.textSecondary },
  guideCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 24,
    marginTop: 8,
  },
  guideTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 14 },
  guideItem: { marginBottom: 12 },
  guideItemLabel: { fontSize: 13, fontWeight: "600", color: T.accent, marginBottom: 2 },
  guideItemTip: { fontSize: 12, color: T.textSecondary, lineHeight: 17 },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnDisabled: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    backgroundColor: T.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryBtnText: { color: T.textPrimary, fontWeight: "600", fontSize: 15 },
});
