import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import * as Haptics from "expo-haptics";
import {
  supportsAlternateIcons,
  setAlternateAppIcon,
  getAppIconName,
  resetAppIcon,
} from "expo-alternate-app-icons";
import { T } from "@/lib/theme";
import { useUpgradeGate } from "@/contexts/UpgradeGateContext";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const ICON_OPTIONS = [
  { name: null, labelKey: "app_icon.signal_a", source: require("@/assets/icon.png") },
  { name: "Orbit", labelKey: "app_icon.orbit_node", source: require("@/assets/icon-orbit.png") },
  { name: "Waveform", labelKey: "app_icon.waveform", source: require("@/assets/icon-waveform.png") },
  { name: "Focus", labelKey: "app_icon.focus_bracket", source: require("@/assets/icon-focus.png") },
] as const;

export default function AppIconScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const { presentUpgrade } = useUpgradeGate();
  const [activeIcon, setActiveIcon] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const { data: tier, isLoading } = useQuery({
    queryKey: ["subscription-status-tier"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/subscriptions/status`);
      return res.data?.data?.tier as string;
    },
  });

  useEffect(() => {
    setActiveIcon(getAppIconName());
  }, []);

  const selectIcon = async (name: string | null) => {
    if (isSwitching || name === activeIcon) return;
    setIsSwitching(true);
    try {
      if (name === null) {
        await resetAppIcon();
      } else {
        await setAlternateAppIcon(name);
      }
      setActiveIcon(name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t("common.error"), t("app_icon.error_switch"));
    } finally {
      setIsSwitching(false);
    }
  };

  const isElite = tier === "elite";

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("app_icon.title")}</Text>
      </View>

      {isLoading ? (
        <View style={s.loadingScreen}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : !supportsAlternateIcons ? (
        <View style={s.centerCard}>
          <Text style={s.centerIcon}>📱</Text>
          <Text style={s.centerTitle}>{t("app_icon.unsupported_title")}</Text>
          <Text style={s.centerSub}>{t("app_icon.unsupported_sub")}</Text>
        </View>
      ) : !isElite ? (
        <View style={s.centerCard}>
          <Text style={s.centerIcon}>🔒</Text>
          <Text style={s.centerTitle}>{t("app_icon.locked_title")}</Text>
          <Text style={s.centerSub}>{t("app_icon.locked_sub")}</Text>
          <TouchableOpacity onPress={presentUpgrade} style={s.upgradeBtn} activeOpacity={0.85}>
            <Text style={s.upgradeBtnText}>{t("app_icon.upgrade_button")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={s.sub}>{t("app_icon.subtitle")}</Text>
          <View style={s.grid}>
            {ICON_OPTIONS.map((opt) => {
              const selected = opt.name === activeIcon;
              return (
                <TouchableOpacity
                  key={opt.labelKey}
                  onPress={() => selectIcon(opt.name)}
                  style={s.tile}
                  activeOpacity={0.8}
                  disabled={isSwitching}
                >
                  <View style={[s.iconFrame, selected && s.iconFrameSelected]}>
                    <Image source={opt.source} style={s.iconImage} />
                    {selected && (
                      <View style={s.checkBadge}>
                        <Text style={s.checkBadgeText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.tileLabel, selected && s.tileLabelSelected]}>{t(opt.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  backBtn: { marginRight: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary },

  sub: { fontSize: 13, color: T.textSecondary, paddingHorizontal: 20, marginBottom: 20, lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 16, justifyContent: "center" },
  tile: { width: "40%", alignItems: "center" },
  iconFrame: {
    width: 96, height: 96, borderRadius: 24, overflow: "hidden",
    borderWidth: 2, borderColor: "transparent", position: "relative",
  },
  iconFrameSelected: { borderColor: T.accent },
  iconImage: { width: "100%", height: "100%" },
  checkBadge: {
    position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: T.accent, alignItems: "center", justifyContent: "center",
  },
  checkBadgeText: { color: "#000", fontWeight: "800", fontSize: 12 },
  tileLabel: { marginTop: 10, fontSize: 13, fontWeight: "600", color: T.textSecondary, textAlign: "center" },
  tileLabelSelected: { color: T.textPrimary },

  centerCard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  centerIcon: { fontSize: 40, marginBottom: 16 },
  centerTitle: { fontSize: 18, fontWeight: "700", color: T.textPrimary, textAlign: "center", marginBottom: 8 },
  centerSub: { fontSize: 14, color: T.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  upgradeBtn: { backgroundColor: T.accent, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  upgradeBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
});
