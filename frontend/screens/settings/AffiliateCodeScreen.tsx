import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function AffiliateCodeScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const { mutate: applyCode, isPending } = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/affiliate/apply-code`, { code: code.trim() });
    },
    onSuccess: () => {
      setErrorKey(null);
      setApplied(true);
    },
    onError: (error: any) => {
      const code = error?.response?.data?.error;
      if (code === "already_attributed") setErrorKey("affiliate_code.error_already_attributed");
      else if (code === "code_not_found") setErrorKey("affiliate_code.error_not_found");
      else setErrorKey("affiliate_code.error_generic");
    },
  });

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("affiliate_code.title")}</Text>
      </View>

      <View style={s.card}>
        {applied ? (
          <Text style={s.successText}>{t("affiliate_code.success")}</Text>
        ) : (
          <>
            <Text style={s.cardSub}>{t("affiliate_code.subtitle")}</Text>
            <TextInput
              placeholder={t("affiliate_code.placeholder")}
              placeholderTextColor={T.textMuted}
              style={s.input}
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setErrorKey(null);
              }}
            />
            {errorKey && <Text style={s.errorText}>{t(errorKey)}</Text>}
            <TouchableOpacity
              onPress={() => applyCode()}
              disabled={!code.trim() || isPending}
              style={[s.submitBtn, (!code.trim() || isPending) && s.submitBtnDisabled]}
            >
              {isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.submitBtnText}>{t("affiliate_code.submit")}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  backBtn: { marginRight: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary },
  card: {
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
  },
  cardSub: { fontSize: 13, color: T.textSecondary, lineHeight: 19, marginBottom: 16 },
  input: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: T.textPrimary,
    fontSize: 15,
    letterSpacing: 1,
    marginBottom: 12,
  },
  errorText: { fontSize: 12, color: T.red, marginBottom: 12 },
  submitBtn: { backgroundColor: T.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  submitBtnDisabled: { backgroundColor: T.surface },
  submitBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  successText: { fontSize: 14, color: T.textPrimary, lineHeight: 20 },
});
