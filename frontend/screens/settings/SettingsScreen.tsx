import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  FlatList,
  Linking,
  StyleSheet,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useTranslation } from "react-i18next";
import i18n, { LANGUAGE_CODES } from "@/lib/i18n";
import { formatWeight, lbsToKg } from "@/lib/units";
import { T } from "@/lib/theme";
import { COUNTRIES, getCountryByName } from "@/lib/currency";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legal-urls";

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

export default function SettingsScreen() {
  const navigation = useNavigation() as any;
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [newWeight, setNewWeight] = useState("");
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);

  const { data: profile, refetch: refetchProfile, isRefetching } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const unitSystem = profile?.unitSystem ?? "imperial";
  const currentLanguage = profile?.language ?? "English";

  const { mutate: updateWeight, isPending: isUpdating } = useMutation({
    mutationFn: async (weightInDisplayUnit: number) => {
      const weightKg = unitSystem === "metric" ? weightInDisplayUnit : lbsToKg(weightInDisplayUnit);
      await axios.patch(`${API_URL}/api/auth/profile`, { weight: Math.round(weightKg * 10) / 10 });
    },
    onSuccess: () => {
      setNewWeight("");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert(t("settings.updated"), t("settings.weight_updated"));
    },
    onError: () => Alert.alert(t("common.error"), t("settings.error_weight")),
  });

  const { mutate: updateUnitSystem, isPending: isSavingUnit } = useMutation({
    mutationFn: async (newUnitSystem: "imperial" | "metric") => {
      await axios.patch(`${API_URL}/api/auth/profile`, { unitSystem: newUnitSystem });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: () => Alert.alert(t("common.error"), t("settings.error_unit")),
  });

  const { mutate: updateLanguage, isPending: isSavingLanguage } = useMutation({
    mutationFn: async (lang: string) => {
      await axios.patch(`${API_URL}/api/auth/profile`, { language: lang });
    },
    onSuccess: (_, lang) => {
      queryClient.setQueryData(["profile"], (old: any) => old ? { ...old, language: lang } : old);
    },
    onError: () => Alert.alert(t("common.error"), t("settings.error_language")),
  });

  const { mutate: updateCountry, isPending: isSavingCountry } = useMutation({
    mutationFn: async (countryName: string) => {
      const info = getCountryByName(countryName);
      await axios.patch(`${API_URL}/api/auth/profile`, {
        country: countryName,
        currency: info?.currency.toLowerCase() ?? "usd",
      });
    },
    onSuccess: (_, countryName) => {
      const info = getCountryByName(countryName);
      queryClient.setQueryData(["profile"], (old: any) =>
        old ? { ...old, country: countryName, currency: info?.currency.toLowerCase() ?? "usd" } : old
      );
    },
    onError: () => Alert.alert(t("common.error"), t("settings.error_country")),
  });

  const currentCountry = profile?.country ?? "United States";
  const currentCountryInfo = getCountryByName(currentCountry);

  const { mutate: exportData, isPending: isExporting } = useMutation({
    mutationFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/account`);
      return res.data;
    },
    onSuccess: () => Alert.alert(t("settings.export_data"), t("settings.export_success_msg")),
    onError: () => Alert.alert(t("common.error"), t("settings.error_export")),
  });

  const handleDeleteAccount = () => {
    Alert.alert(
      t("settings.delete_confirm_title"),
      t("settings.delete_confirm_msg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.delete_account"),
          style: "destructive",
          onPress: () => {
            Alert.alert(
              t("settings.delete_confirm_title2"),
              t("settings.delete_confirm_msg2"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("settings.delete_final"),
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await axios.delete(`${API_URL}/api/auth/account`);
                      await signOut();
                    } catch {
                      Alert.alert(t("common.error"), t("settings.error_delete"));
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetchProfile} tintColor={T.accent} />
      }
    >
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>

        <Text style={s.heading}>{t("settings.title")}</Text>

        {/* Account Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("settings.account")}</Text>
          {[
            { label: t("settings.name"),  value: profile?.name ?? "—" },
            { label: t("settings.email"), value: profile?.email ?? "—" },
            { label: t("settings.age"),   value: profile?.age ? `${profile.age} ${t("settings.age_unit")}` : "—" },
          ].map(({ label, value }, i, arr) => (
            <View key={label} style={[s.row, i < arr.length - 1 && s.rowBorder]}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Units */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("settings.units")}</Text>
          <View style={s.segmentTrack}>
            {(["imperial", "metric"] as const).map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => updateUnitSystem(u)}
                disabled={isSavingUnit}
                style={[s.segmentBtn, unitSystem === u && s.segmentBtnActive]}
              >
                {isSavingUnit && unitSystem === u ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={[s.segmentText, unitSystem === u && s.segmentTextActive]}>
                    {u === "imperial" ? t("settings.imperial") : t("settings.metric")}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Language */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("settings.language")}</Text>
          <TouchableOpacity
            onPress={() => setLangModalVisible(true)}
            disabled={isSavingLanguage}
            style={s.langPicker}
          >
            <Text style={s.langPickerText}>{currentLanguage}</Text>
            {isSavingLanguage
              ? <ActivityIndicator size="small" color={T.accent} />
              : <Text style={s.chevron}>▼</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Country & Currency */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("settings.country_currency")}</Text>
          <Text style={s.cardSub}>{t("settings.country_currency_sub")}</Text>
          <TouchableOpacity
            onPress={() => setCountryModalVisible(true)}
            disabled={isSavingCountry}
            style={s.langPicker}
          >
            <View>
              <Text style={s.langPickerText}>{currentCountry}</Text>
              {currentCountryInfo && (
                <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>
                  {currentCountryInfo.currency} — {currentCountryInfo.symbol}
                </Text>
              )}
            </View>
            {isSavingCountry
              ? <ActivityIndicator size="small" color={T.accent} />
              : <Text style={s.chevron}>▼</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Update Weight */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("settings.update_weight")}</Text>
          <Text style={s.cardSub}>{t("settings.current_weight")}: {formatWeight(profile?.weight, unitSystem)}</Text>
          <View style={s.weightRow}>
            <TextInput
              style={s.weightInput}
              placeholder={t("settings.weight_placeholder")}
              placeholderTextColor={T.textMuted}
              keyboardType="decimal-pad"
              value={newWeight}
              onChangeText={setNewWeight}
              returnKeyType="done"
              onSubmitEditing={() => newWeight && updateWeight(Number(newWeight))}
            />
            <TouchableOpacity
              style={[s.weightSaveBtn, (!newWeight || isUpdating) && s.weightSaveBtnDisabled]}
              onPress={() => newWeight && updateWeight(Number(newWeight))}
              disabled={!newWeight || isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={s.weightSaveBtnText}>{t("common.save")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications */}
        <TouchableOpacity style={[s.card, s.rowCard]} onPress={() => navigation.navigate("Notifications")}>
          <View>
            <Text style={s.cardTitle}>{t("settings.notifications")}</Text>
            <Text style={s.cardSub}>{t("settings.notifications_sub")}</Text>
          </View>
          <Text style={s.arrow}>→</Text>
        </TouchableOpacity>

        {/* Privacy & Data */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("settings.privacy_data")}</Text>
          <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <View>
              <Text style={s.rowLabel}>{t("settings.privacy_policy")}</Text>
              <Text style={s.cardSub}>{t("settings.privacy_policy_sub")}</Text>
            </View>
            <Text style={s.arrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => Linking.openURL(TERMS_URL)}>
            <View>
              <Text style={s.rowLabel}>{t("settings.terms_of_service")}</Text>
              <Text style={s.cardSub}>{t("settings.terms_of_service_sub")}</Text>
            </View>
            <Text style={s.arrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => exportData()}>
            <View>
              <Text style={s.rowLabel}>{t("settings.export_data")}</Text>
              <Text style={s.cardSub}>{t("settings.export_sub")}</Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color={T.textMuted} />
            ) : (
              <Text style={s.arrow}>→</Text>
            )}
          </TouchableOpacity>
          <View style={[s.row, s.rowBorder]}>
            <Text style={s.rowLabel}>{t("settings.data_we_store")}</Text>
          </View>
          <Text style={s.dataNote}>{t("settings.data_note")}</Text>
        </View>

        {/* Subscription */}
        <TouchableOpacity style={[s.card, s.subCard, s.rowCard]} onPress={() => navigation.navigate("Pricing")}>
          <View>
            <Text style={s.subCardTitle}>{t("settings.manage_subscription")}</Text>
            <Text style={s.subCardSub}>{t("settings.subscription_sub")}</Text>
          </View>
          <Text style={s.subCardArrow}>→</Text>
        </TouchableOpacity>

        {/* Danger Zone */}
        <View style={[s.card, s.dangerCard]}>
          <Text style={s.dangerLabel}>{t("settings.danger_zone")}</Text>
          <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount}>
            <Text style={s.deleteBtnText}>{t("settings.delete_account")}</Text>
          </TouchableOpacity>
          <Text style={s.deleteNote}>{t("settings.delete_note")}</Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[s.card, { alignItems: "center" }]}
          onPress={() =>
            Alert.alert(t("settings.sign_out_confirm_title"), t("settings.sign_out_confirm_msg"), [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("settings.sign_out"), style: "destructive", onPress: () => signOut() },
            ])
          }
        >
          <Text style={{ color: T.red, fontWeight: "700", fontSize: 15 }}>{t("settings.sign_out")}</Text>
        </TouchableOpacity>
      </View>

      {/* Country picker modal */}
      <Modal visible={countryModalVisible} animationType="slide" transparent>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t("settings.select_country")}</Text>
              <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
                <Text style={s.modalDone}>{t("common.done")}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    updateCountry(item.name);
                    setCountryModalVisible(false);
                  }}
                  style={s.langItem}
                >
                  <View>
                    <Text style={s.langItemText}>{item.name}</Text>
                    <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 1 }}>
                      {item.currency} — {item.symbol}
                    </Text>
                  </View>
                  {currentCountry === item.name && <Text style={s.langCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Language picker modal */}
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
                    updateLanguage(item);
                    const code = LANGUAGE_CODES[item];
                    if (code) await i18n.changeLanguage(code);
                    setLangModalVisible(false);
                  }}
                  style={s.langItem}
                >
                  <Text style={s.langItemText}>{item}</Text>
                  {currentLanguage === item && <Text style={s.langCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  heading: { fontSize: 26, fontWeight: "800", color: T.textPrimary, marginBottom: 24 },

  card: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 12 },
  cardSub: { fontSize: 12, color: T.textMuted, marginBottom: 10 },
  rowCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: T.border },
  rowLabel: { fontSize: 14, color: T.textSecondary },
  rowValue: { fontSize: 14, color: T.textPrimary, fontWeight: "500", maxWidth: "60%" },

  segmentTrack: { flexDirection: "row", backgroundColor: T.surface2, borderRadius: 10, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segmentBtnActive: { backgroundColor: T.accent },
  segmentText: { fontSize: 13, fontWeight: "600", color: T.textSecondary },
  segmentTextActive: { color: T.black },

  langPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: T.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  langPickerText: { fontSize: 15, color: T.textPrimary },
  chevron: { color: T.textMuted, fontSize: 12 },

  weightRow: { flexDirection: "row", gap: 10 },
  weightInput: {
    flex: 1,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: T.textPrimary,
    fontSize: 14,
  },
  weightSaveBtn: { backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  weightSaveBtnDisabled: { backgroundColor: T.surface2 },
  weightSaveBtnText: { color: "#000", fontWeight: "700" },

  arrow: { fontSize: 18, color: T.textMuted },

  dataNote: { fontSize: 12, color: T.textMuted, lineHeight: 18, marginTop: 4 },

  subCard: { backgroundColor: T.amberDark, borderColor: T.amberBorder },
  subCardTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 2 },
  subCardSub: { fontSize: 12, color: T.amber },
  subCardArrow: { fontSize: 18, color: T.amber },

  dangerCard: { backgroundColor: T.redDark, borderColor: T.redBorder },
  dangerLabel: { fontSize: 11, fontWeight: "800", color: T.red, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  deleteBtn: { backgroundColor: T.red, borderRadius: 10, padding: 14, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  deleteNote: { fontSize: 12, color: T.red, textAlign: "center", marginTop: 8 },

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
});
