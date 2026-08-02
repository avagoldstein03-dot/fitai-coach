import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

const STORAGE_KEY = "hasAcceptedDisclaimer";

const BODY_KEYS = ["disclaimer.body_p1", "disclaimer.body_p2", "disclaimer.body_p3", "disclaimer.body_p4"] as const;

export function DisclaimerGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((value) => {
      setAccepted(value === "true");
    });
  }, []);

  const accept = async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, "true");
    setAccepted(true);
  };

  if (accepted === null) return <>{children}</>;

  return (
    <>
      {children}
      <Modal visible={!accepted} transparent animationType="fade">
        <View style={s.backdrop}>
          <View style={s.card}>
            <View style={s.header}>
              <Text style={s.emoji}>⚠️</Text>
              <Text style={s.title}>{t("disclaimer.title")}</Text>
              <Text style={s.subtitle}>{t("disclaimer.subtitle")}</Text>
            </View>

            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
              {BODY_KEYS.map((key) => (
                <Text key={key} style={s.para}>{t(key)}</Text>
              ))}
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity onPress={accept} style={s.agreeBtn} activeOpacity={0.85}>
                <Text style={s.agreeBtnText}>{t("disclaimer.agree")}</Text>
              </TouchableOpacity>
              <Text style={s.finePrint}>{t("disclaimer.required")}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 24,
  },
  header: { alignItems: "center", marginBottom: 16 },
  emoji: { fontSize: 36, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: "800", color: T.textPrimary, marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 13, color: T.textSecondary, textAlign: "center" },
  scroll: { marginBottom: 20 },
  para: { fontSize: 13.5, color: T.textSecondary, lineHeight: 20, marginBottom: 12 },
  footer: { gap: 10 },
  agreeBtn: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  agreeBtnText: { color: "#000", fontWeight: "800", fontSize: 16 },
  finePrint: { fontSize: 11, color: T.textMuted, textAlign: "center" },
});
