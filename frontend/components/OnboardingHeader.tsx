import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

const TOTAL_STEPS = 8;

interface Props {
  step: number;
  showBack?: boolean;
}

export default function OnboardingHeader({ step, showBack = true }: Props) {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const pct = (step / TOTAL_STEPS) * 100;

  return (
    <View style={s.wrapper}>
      <View style={s.row}>
        {showBack && step > 1 ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={12} accessibilityLabel={t("common.back")} accessibilityRole="button">
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.backPlaceholder} />
        )}
        <Text style={s.stepLabel}>
          {t("onboarding.step_label", { step, total: TOTAL_STEPS })}
        </Text>
        <View style={s.backPlaceholder} />
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%` as any }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backBtn: { width: 36, alignItems: "flex-start" },
  backPlaceholder: { width: 36 },
  backText: { fontSize: 26, color: T.accent, fontWeight: "400", lineHeight: 28 },
  stepLabel: { fontSize: 13, color: T.textSecondary, fontWeight: "600" },
  track: {
    height: 4,
    backgroundColor: T.surface2,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: T.accent,
    borderRadius: 2,
  },
});
