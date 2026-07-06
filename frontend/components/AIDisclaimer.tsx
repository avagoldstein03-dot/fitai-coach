import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

export function AIDisclaimer({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <View style={s.container}>
      <Text style={s.text}>⚠️ {message ?? t("ai_disclaimer.message")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: T.amberDark,
    borderWidth: 1,
    borderColor: T.amberBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  text: { color: T.amber, fontSize: 12, lineHeight: 18 },
});
