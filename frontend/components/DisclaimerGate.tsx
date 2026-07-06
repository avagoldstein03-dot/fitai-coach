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
      <Modal visible={!accepted} animationType="fade">
        <View style={s.screen}>
          <View style={s.header}>
            <Text style={s.emoji}>⚠️</Text>
            <Text style={s.title}>{t("disclaimer.title")}</Text>
            <Text style={s.subtitle}>{t("disclaimer.subtitle")}</Text>
          </View>

          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.textCard}>
              {BODY_KEYS.map((key) => (
                <Text key={key} style={s.para}>{t(key)}</Text>
              ))}
            </View>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity onPress={accept} style={s.agreeBtn} activeOpacity={0.85}>
              <Text style={s.agreeBtnText}>{t("disclaimer.agree")}</Text>
            </TouchableOpacity>
            <Text style={s.finePrint}>{t("disclaimer.required")}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bg,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  header: { alignItems: "center", marginBottom: 28 },
  emoji: { fontSize: 44, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", color: T.textPrimary, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: T.textSecondary, textAlign: "center" },
  scroll: { flex: 1 },
  textCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    gap: 14,
    marginBottom: 24,
  },
  para: { fontSize: 14, color: T.textSecondary, lineHeight: 22 },
  footer: { gap: 12 },
  agreeBtn: {
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  agreeBtnText: { color: "#000", fontWeight: "800", fontSize: 17 },
  finePrint: { fontSize: 12, color: T.textMuted, textAlign: "center" },
});
